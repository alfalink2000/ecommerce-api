import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.database import get_session
from app.models.user import User, UserRole
from app.services.auth import hash_password


class FakeRedis:
    def __init__(self):
        self._store = {}

    def setex(self, key, ttl, value):
        self._store[key] = value

    def get(self, key):
        return self._store.get(key)

    def exists(self, key):
        return 1 if key in self._store else 0

    def delete(self, key):
        self._store.pop(key, None)

    def ttl(self, key):
        return 60

    def ping(self):
        return True

    def incr(self, key):
        return 1

    def expire(self, key, ttl):
        pass

    def pipeline(self):
        return self

    def execute(self):
        return []


fake_redis = FakeRedis()


@pytest.fixture(autouse=True)
def mock_redis():
    with patch("app.services.redis.redis_client", fake_redis), \
         patch("app.middleware.auth.verify_token_exists", side_effect=lambda t, tp="access": fake_redis.exists(f"{tp}:{t}") == 1), \
         patch("app.middleware.rate_limit.redis_client", fake_redis):
        fake_redis._store.clear()
        yield fake_redis
        fake_redis._store.clear()


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(engine):
    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="admin_user")
def admin_user_fixture(session):
    user = User(
        email="admin@test.com",
        password_hash=hash_password("admin123"),
        full_name="Admin Test",
        role=UserRole.admin,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="customer_user")
def customer_user_fixture(session):
    user = User(
        email="cliente@test.com",
        password_hash=hash_password("cliente123"),
        full_name="Cliente Test",
        role=UserRole.customer,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_auth_headers(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
