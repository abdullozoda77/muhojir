import base64
import logging

from app.assistant.providers import BUSY, NOT_CONFIGURED, UNAVAILABLE, AssistantError, _is_resting, _rest, active_provider
from app.core.config import settings

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {"tg": "Tajik (Cyrillic script)", "ru": "Russian", "en": "English", "zh": "Simplified Chinese"}
NO_TEXT = "NO_TEXT"
GEMINI_TIMEOUT_MS = 90_000

NOTHING_TO_READ = ("no_text", "No text was found in the file. Send a clearer photo.", 422)
REFUSED = ("refused", "This document cannot be translated.", 422)


def instructions(source_lang, target_lang):
    source = f"from {LANGUAGE_NAMES[source_lang]}" if source_lang in LANGUAGE_NAMES else "(detect its language yourself)"
    return (
        f"You are a professional translator of official documents for migrants. Translate the document {source} "
        f"into {LANGUAGE_NAMES[target_lang]}.\n"
        "Rules:\n"
        "- Translate every line, including stamps, seals, small print and handwritten parts.\n"
        "- Keep the layout: the same order, headings and line breaks; write table rows as cells separated by ' | '.\n"
        "- Copy numbers, dates, series and document numbers exactly as they are.\n"
        "- Write personal names, places and organisations in the target language's usual spelling and add the "
        "original spelling in brackets the first time.\n"
        "- Describe stamps, seals, signatures and photos in square brackets in the target language, "
        "for example [seal: ...], [signature], [photo].\n"
        "- Mark parts you cannot read as [unreadable] in the target language.\n"
        "- Answer with the translation only: no introduction, no comments, no Markdown.\n"
        f"- If there is no text to translate, answer exactly {NO_TEXT}."
    )


def finish(reply):
    reply = (reply or "").strip()
    if not reply or reply == NO_TEXT:
        raise AssistantError(*NOTHING_TO_READ)
    return reply


async def translate(source_lang, target_lang, text="", data=None, mime=""):
    provider = active_provider()
    if provider is None:
        raise AssistantError("not_configured", "The AI translator is not set up yet.", 503)
    prompt = instructions(source_lang, target_lang)
    text = f"Text to translate:\n{text}" if text else ""
    if provider == "gemini":
        return finish(await _gemini(prompt, text, data, mime))
    return finish(await _claude(prompt, text, data, mime))


async def _gemini(prompt, text, data, mime):
    import httpx
    from google import genai
    from google.genai import errors, types

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=1)),
    )
    config = types.GenerateContentConfig(
        system_instruction=prompt,
        thinking_config=types.ThinkingConfig(thinking_level="low"),
        max_output_tokens=16384,
    )
    parts = [types.Part.from_bytes(data=data, mime_type=mime)] if data else []
    parts.append(types.Part.from_text(text=text or "Translate this document."))
    contents = [types.Content(role="user", parts=parts)]

    models = sorted(settings.gemini_models, key=_is_resting)
    for i, model in enumerate(models):
        try:
            response = await client.aio.models.generate_content(model=model, contents=contents, config=config)
        except errors.APIError as e:
            logger.warning("AI translator (Gemini %s): %s %s", model, e.code, e.message)
            if e.code in (401, 403) or (e.code == 400 and "API key" in (e.message or "")):
                raise AssistantError(*NOT_CONFIGURED)
            if e.code in (404, 429, 500, 503, 504):
                _rest(model)
                if i + 1 < len(models):
                    continue
            raise AssistantError(*(BUSY if e.code == 429 else UNAVAILABLE))
        except (httpx.HTTPError, OSError) as e:
            logger.warning("AI translator (Gemini %s): network error: %r", model, e)
            if isinstance(e, httpx.TimeoutException):
                _rest(model)
                if i + 1 < len(models):
                    continue
            raise AssistantError(*UNAVAILABLE)
        candidate = response.candidates[0] if response.candidates else None
        if candidate is None or candidate.content is None:
            raise AssistantError(*REFUSED)
        return response.text


async def _claude(prompt, text, data, mime):
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=180, max_retries=2)
    content = []
    if data:
        source = {"type": "base64", "media_type": mime, "data": base64.b64encode(data).decode()}
        content.append({"type": "document" if mime == "application/pdf" else "image", "source": source})
    content.append({"type": "text", "text": text or "Translate this document."})
    try:
        response = await client.messages.create(
            model=settings.assistant_model,
            max_tokens=16000,
            system=prompt,
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.AuthenticationError:
        logger.error("AI translator: the ANTHROPIC_API_KEY was rejected")
        raise AssistantError(*NOT_CONFIGURED)
    except anthropic.RateLimitError:
        raise AssistantError(*BUSY)
    except anthropic.BadRequestError as e:
        logger.error("AI translator: bad request: %s", e.message)
        raise AssistantError("unavailable", "The AI translator could not read this file.", 502)
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        logger.warning("AI translator: API unavailable: %s", e)
        raise AssistantError(*UNAVAILABLE)
    if response.stop_reason == "refusal":
        raise AssistantError(*REFUSED)
    return "".join(block.text for block in response.content if block.type == "text")
