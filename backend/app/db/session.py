"""Database engine, session factory, and FastAPI dependency."""
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()


def _normalise_database_url(url: str) -> str:
    """Coerce common Postgres URL variants to use the psycopg3 driver.

    Hosted-Postgres providers (Neon, Supabase, Vercel, Heroku, RDS) typically
    inject ``postgresql://...`` or the legacy ``postgres://...``. SQLAlchemy
    needs an explicit driver suffix to use psycopg3 (which is what we ship in
    requirements.txt). Doing this here means the operator can paste the URL
    they're given verbatim and it just works.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


_database_url = _normalise_database_url(settings.database_url)

# SQLite needs check_same_thread=False when used with FastAPI's threadpool.
connect_args = {"check_same_thread": False} if _database_url.startswith("sqlite") else {}

engine = create_engine(
    _database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables. For the MVP we use create_all; Alembic migrations are wired up too."""
    # Import models so they are registered with the metadata
    from app.models import order, activity_log  # noqa: F401

    Base.metadata.create_all(bind=engine)
