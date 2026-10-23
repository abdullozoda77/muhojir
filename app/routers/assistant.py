"""AI assistant of the site: answers about migration and the site, and opens pages for the visitor.

GET tells whether the assistant is set up; POST sends the conversation and returns
{"reply", "navigate" (a page address to open, or null), "refused", "truncated"}."""
from typing import Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import Field, field_validator

from app.assistant.knowledge import system_prompt
from app.assistant.providers import AssistantError, active_provider, ask
from app.core.deps import DB, OptionalUser
from app.core.throttle import throttle
from app.schemas.common import Form

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

LANGUAGE_NAMES = {"ru": "Russian", "tg": "Tajik"}
MAX_HISTORY = 20  # messages sent back to the model; older ones are dropped


class ChatMessage(Form):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class Chat(Form):
    messages: list[ChatMessage] = Field(min_length=1)
    page: str = Field("", max_length=200)  # where the visitor is now

    @field_validator("messages")
    @classmethod
    def last_from_user(cls, messages):
        messages = messages[-MAX_HISTORY:]
        while messages and messages[0].role != "user":
            messages = messages[1:]
        if not messages or messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        if len(messages[-1].content) > 1000:
            raise ValueError("The question is too long (1000 characters at most).")
        return messages


def site_language(request, user):
    if user is not None and user.language in LANGUAGE_NAMES:
        return user.language
    header = (request.headers.get("accept-language") or "").lower()
    return "ru" if header.startswith("ru") else "tg"


@router.get("/")
async def status():
    return {"enabled": active_provider() is not None}


@router.post("/", dependencies=[Depends(throttle("assistant"))])
async def chat(data: Chat, request: Request, db: DB, user: OptionalUser):
    if active_provider() is None:
        return JSONResponse({"code": "not_configured", "detail": "The AI assistant is not set up yet."}, status_code=503)
    visitor_note = (
        f"Site language of this visitor: {LANGUAGE_NAMES[site_language(request, user)]}. "
        f"Logged in: {'yes, ' + (user.full_name or 'no name') if user else 'no'}. "
        f"Current page: {data.page or '/'}."
    )
    messages = [{"role": m.role, "content": m.content} for m in data.messages]
    try:
        return await ask(db, system_prompt(), visitor_note, messages, user)
    except AssistantError as error:
        return JSONResponse({"code": error.code, "detail": error.detail}, status_code=error.http_status)
