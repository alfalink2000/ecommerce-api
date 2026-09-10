from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.redis import verify_token_exists
from app.services.auth import decode_token

PUBLIC_PATHS = [
    "/",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/health",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/products",
    "/static",
]

PUBLIC_METHODS = ["GET"]


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in PUBLIC_PATHS or path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/static") or path == "/favicon.ico":
            return await call_next(request)

        if path.startswith("/api/v1/products") and request.method == "GET":
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Token de autenticacion requerido"},
            )

        token = auth_header.split(" ", 1)[1]

        if not verify_token_exists(token, "access"):
            return JSONResponse(
                status_code=401,
                content={"detail": "Token no valido o sesion cerrada"},
            )

        try:
            payload = decode_token(token)
            request.state.user_id = int(payload.get("sub"))
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token invalido o expirado"},
            )

        return await call_next(request)
