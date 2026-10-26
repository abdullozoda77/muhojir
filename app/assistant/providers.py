import json
import logging
import time

from app.core.config import settings
from app.assistant.tools import TOOLS, run_tool

logger = logging.getLogger(__name__)

MAX_TOOL_STEPS = 6
GEMINI_TIMEOUT_MS = 15_000
RESTING = 300
_resting: dict[str, float] = {}


class AssistantError(Exception):
    def __init__(self, code, detail, http_status):
        super().__init__(detail)
        self.code = code
        self.detail = detail
        self.http_status = http_status


NOT_CONFIGURED = ("not_configured", "The AI assistant key is not valid.", 503)
BUSY = ("busy", "The AI assistant is busy. Try again in a minute.", 429)
UNAVAILABLE = ("unavailable", "The AI assistant is not available right now.", 503)
TOO_LONG = ("too_long", "The question needed too many steps. Try asking it more simply.", 502)


def active_provider():
    if settings.gemini_api_key:
        return "gemini"
    if settings.anthropic_api_key:
        return "claude"
    return None


class Run:

    def __init__(self, db, user):
        self.db = db
        self.user = user
        self.navigate = None

    async def tool(self, name, tool_input):
        text, is_error, path = await run_tool(self.db, name, tool_input, self.user)
        if path:
            self.navigate = path
        return text, is_error


async def ask(db, system_text, visitor_note, messages, user=None):
    run = Run(db, user)
    if active_provider() == "gemini":
        answer = await _ask_gemini(system_text, visitor_note, messages, run)
    else:
        answer = await _ask_claude(system_text, visitor_note, messages, run)
    return {**answer, "navigate": run.navigate}


def _rest(model):
    _resting[model] = time.monotonic() + RESTING


def _is_resting(model):
    return _resting.get(model, 0) > time.monotonic()


async def _ask_gemini(system_text, visitor_note, messages, run):
    import httpx
    from google import genai
    from google.genai import errors, types

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=1)),
    )
    config = types.GenerateContentConfig(
        system_instruction=f"{system_text}\n{visitor_note}",
        tools=[types.Tool(function_declarations=[
            types.FunctionDeclaration(
                name=tool["name"],
                description=tool["description"],
                parameters_json_schema={k: v for k, v in tool["input_schema"].items() if k != "additionalProperties"},
            )
            for tool in TOOLS
        ])],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        thinking_config=types.ThinkingConfig(thinking_level="low"),
        max_output_tokens=2048,
    )
    question = [
        types.Content(role="user" if m["role"] == "user" else "model", parts=[types.Part.from_text(text=m["content"])])
        for m in messages
    ]

    models = sorted(settings.gemini_models, key=_is_resting)
    for i, model in enumerate(models):
        try:
            return await _gemini_answer(client, model, config, list(question), types, run)
        except errors.APIError as e:
            logger.warning("AI assistant (Gemini %s): %s %s", model, e.code, e.message)
            if e.code in (401, 403) or (e.code == 400 and "API key" in (e.message or "")):
                raise AssistantError(*NOT_CONFIGURED)
            if e.code in (404, 429, 500, 503, 504):
                _rest(model)
                if i + 1 < len(models):
                    continue
            raise AssistantError(*(BUSY if e.code == 429 else UNAVAILABLE))
        except (httpx.HTTPError, OSError) as e:
            logger.warning("AI assistant (Gemini %s): network error: %r", model, e)
            if isinstance(e, httpx.TimeoutException):
                _rest(model)
                if i + 1 < len(models):
                    continue
            raise AssistantError(*UNAVAILABLE)


async def _gemini_answer(client, model, config, contents, types, run):
    for _ in range(MAX_TOOL_STEPS):
        response = await client.aio.models.generate_content(model=model, contents=contents, config=config)
        candidate = response.candidates[0] if response.candidates else None
        if candidate is None or candidate.content is None:
            return {"reply": "", "refused": True, "truncated": False}
        calls = response.function_calls or []
        if calls:
            contents.append(candidate.content)
            parts = []
            for call in calls:
                text, _ = await run.tool(call.name, dict(call.args or {}))
                parts.append(types.Part(function_response=types.FunctionResponse(id=call.id, name=call.name, response=json.loads(text) if text.startswith("{") else {"error": text})))
            contents.append(types.Content(role="user", parts=parts))
            continue
        reply = (response.text or "").strip()
        finish = str(candidate.finish_reason or "")
        refused = not reply and any(word in finish for word in ("SAFETY", "PROHIBITED", "BLOCKLIST", "SPII"))
        return {"reply": reply, "refused": refused, "truncated": "MAX_TOKENS" in finish}
    raise AssistantError(*TOO_LONG)


async def _ask_claude(system_text, visitor_note, messages, run):
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=120, max_retries=2)
    system = [
        {"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": visitor_note},
    ]
    messages = list(messages)
    try:
        for _ in range(MAX_TOOL_STEPS):
            response = await client.beta.messages.create(
                model=settings.assistant_model,
                max_tokens=4000,
                system=system,
                tools=TOOLS,
                messages=messages,
                thinking={"type": "adaptive"},
                output_config={"effort": settings.assistant_effort},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            if response.stop_reason == "refusal":
                return {"reply": "", "refused": True, "truncated": False}
            if response.stop_reason in ("tool_use", "pause_turn"):
                messages.append({"role": "assistant", "content": response.content})
                results = []
                for block in response.content:
                    if block.type == "tool_use":
                        text, is_error = await run.tool(block.name, block.input)
                        results.append({"type": "tool_result", "tool_use_id": block.id, "content": text, "is_error": is_error})
                if results:
                    messages.append({"role": "user", "content": results})
                continue
            reply = "".join(block.text for block in response.content if block.type == "text").strip()
            return {"reply": reply, "refused": False, "truncated": response.stop_reason == "max_tokens"}
        raise AssistantError(*TOO_LONG)
    except anthropic.AuthenticationError:
        logger.error("AI assistant: the ANTHROPIC_API_KEY was rejected")
        raise AssistantError(*NOT_CONFIGURED)
    except anthropic.RateLimitError:
        raise AssistantError(*BUSY)
    except anthropic.BadRequestError as e:
        logger.error("AI assistant: bad request: %s", e.message)
        raise AssistantError("unavailable", "The AI assistant could not answer.", 502)
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        logger.warning("AI assistant: API unavailable: %s", e)
        raise AssistantError(*UNAVAILABLE)
