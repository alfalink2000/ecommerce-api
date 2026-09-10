import redis
from app.config import REDIS_HOST, REDIS_PORT

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)


def get_redis():
    return redis_client


def store_token(token: str, user_id: int, ttl_seconds: int, token_type: str = "access"):
    key = f"{token_type}:{token}"
    redis_client.setex(key, ttl_seconds, str(user_id))


def verify_token_exists(token: str, token_type: str = "access") -> bool:
    key = f"{token_type}:{token}"
    return redis_client.exists(key) == 1


def delete_token(token: str, token_type: str = "access"):
    key = f"{token_type}:{token}"
    redis_client.delete(key)


def get_user_id_from_token(token: str, token_type: str = "access") -> str | None:
    key = f"{token_type}:{token}"
    return redis_client.get(key)
