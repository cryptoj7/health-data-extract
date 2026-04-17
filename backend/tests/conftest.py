"""Shared test fixtures: in-memory SQLite database + isolated TestClient."""
import os

# Configure env BEFORE importing the app
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REQUIRE_AUTH", "false")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RATE_LIMIT_DEFAULT", "1000/minute")
os.environ.setdefault("RATE_LIMIT_UPLOAD", "1000/minute")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

# Reset cached settings since we mutated env above
get_settings.cache_clear()


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def client(db_engine, monkeypatch):
    TestingSession = sessionmaker(bind=db_engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Middleware uses SessionLocal directly — point it at the in-memory test DB too.
    import app.middleware.activity_logger as al_mw
    import app.db.session as db_session
    monkeypatch.setattr(al_mw, "SessionLocal", TestingSession)
    monkeypatch.setattr(db_session, "SessionLocal", TestingSession)

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
