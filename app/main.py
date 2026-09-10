from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import REDIS_HOST, REDIS_PORT
from app.database import create_db_and_tables
from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.redis import redis_client
from app.routers import auth, users, products, orders
from app.seed import seed_database

app = FastAPI(
    title="Ecommerce API",
    description="API REST para plataforma de comercio electronico",
    version="1.0.0",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.on_event("startup")
def startup():
    create_db_and_tables()
    seed_database()
    try:
        redis_client.ping()
    except Exception:
        print("ADVERTENCIA: Redis no esta disponible. Algunas funciones no funcionaran.")


@app.get("/", response_class=HTMLResponse)
def root():
    return (FRONTEND_DIR / "index.html").read_text(encoding="utf-8")


@app.get("/health")
def health():
    redis_ok = False
    try:
        redis_client.ping()
        redis_ok = True
    except Exception:
        pass
    return {"status": "ok", "redis": redis_ok}
