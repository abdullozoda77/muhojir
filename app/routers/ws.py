from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import read_token
from app.db.session import SessionLocal
from app.models import User
from app.services.live import hub

router = APIRouter()
NOT_LOGGED_IN = 4401


@router.websocket("/ws/notifications/")
async def notifications_socket(socket: WebSocket, token: str = ""):
    payload = read_token(token, "access") if token else None
    user = None
    if payload:
        async with SessionLocal() as db:
            user = await db.get(User, payload["user_id"])
    if user is None or not user.is_active:
        await socket.close(code=NOT_LOGGED_IN)
        return
    await socket.accept()
    hub.add(user.id, socket)
    try:
        while True:
            message = await socket.receive_json()
            if isinstance(message, dict) and message.get("type") == "ping":
                await socket.send_json({"type": "pong"})
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        hub.remove(user.id, socket)
