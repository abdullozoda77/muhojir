from fastapi import APIRouter

from app.core.deps import DB
from app.services import rates as service

router = APIRouter(prefix="/api/rates", tags=["rates"])


@router.get("/")
async def rates(db: DB):
    await service.ensure_fresh(db)
    return {"latest": await service.latest(db), "history": await service.history(db)}
