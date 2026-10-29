import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.admin import setup_admin
from app.core.config import MEDIA_ROOT, settings
from app.core.errors import ApiError, api_error_handler, http_error_handler, validation_error_handler
from app.routers import assistant, auth, course, documents, feedback, flights, jobs, market, places, rates, support, ws
from app.services.live import hub

@asynccontextmanager
async def lifespan(app: FastAPI):
    listener = asyncio.create_task(hub.listen()) if settings.redis_url else None
    yield
    if listener:
        listener.cancel()


app = FastAPI(
    title=settings.app_title,
    description="API for Tajik migrants in Russia: documents and deadlines, patent prices, guides, real jobs, Tajik shops and the rouble to somoni rate",
    version="1.0",
    docs_url="/swagger/",
    redoc_url="/redoc/",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)

for module in (auth, documents, jobs, flights, places, market, rates, course, support, feedback, assistant, ws):
    app.include_router(module.router)

MEDIA_ROOT.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")
setup_admin(app)
