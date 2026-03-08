from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.limiter import limiter
from app.queue import RabbitPublisher
from app.routes import auth, events, metrics, orgs, projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    publisher = RabbitPublisher()
    await publisher.connect()
    app.state.publisher = publisher
    yield
    await publisher.close()


app = FastAPI(title="DevObservatory API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(orgs.router, prefix=settings.api_prefix)
app.include_router(projects.router, prefix=settings.api_prefix)
app.include_router(events.router, prefix=settings.api_prefix)
app.include_router(metrics.router, prefix=settings.api_prefix)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
