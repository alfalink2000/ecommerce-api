from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.redis import redis_client

RATE_LIMITS = {
    "/api/v1/auth/": 5,
    "/api/v1/products": 60,
    "/api/v1/orders": 60,
    "/api/v1/users": 60,
}

RATE_WINDOW = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        path = request.url.path

        limit = None
        for prefix, lmt in RATE_LIMITS.items():
            if path.startswith(prefix):
                limit = lmt
                break

        if limit is None:
            return await call_next(request)

        key = f"ratelimit:{path}:{client_ip}"
        current = redis_client.get(key)

        if current and int(current) >= limit:
            ttl = redis_client.ttl(key)
            return JSONResponse(
                status_code=429,
                content={"detail": "Demasiadas peticiones. Intenta mas tarde."},
                headers={"Retry-After": str(ttl)},
            )

        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, RATE_WINDOW)
        pipe.execute()

        return await call_next(request)
