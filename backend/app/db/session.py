"""Database engine, session factory, and FastAPI dependency."""
import logging
import threading
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger(__name__)

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


def _connect_args_for(url: str) -> dict:
    if url.startswith("sqlite"):
        # SQLite needs this when used with FastAPI's threadpool.
        return {"check_same_thread": False}
    if url.startswith("postgresql+psycopg"):
        # Disable prepared statements for psycopg3. This is required when running
        # against a pooled Postgres connection in transaction mode (e.g. Neon's
        # `-pooler` endpoint, Supabase's pgBouncer, RDS Proxy) and is harmless on
        # direct connections. Without this, the second use of any prepared
        # statement on a recycled backend session raises:
        #   "prepared statement does not exist".
        return {"prepare_threshold": None}
    return {}


engine = create_engine(
    _database_url,
    connect_args=_connect_args_for(_database_url),
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


# --- Lazy schema initialisation ---------------------------------------------
# Vercel's @vercel/python ASGI adapter (and most serverless ASGI adapters) do
# NOT reliably fire FastAPI lifespan events. Relying on lifespan to run
# `create_all` means tables never get created in serverless. So we run it on
# first use of `get_db` instead — once per warm container, idempotent, and
# tolerant of failure (we log and let the actual query produce the real error).

_schema_lock = threading.Lock()
_schema_ready = False


def init_db() -> None:
    """Create all tables registered on `Base.metadata`. Idempotent."""
    # Importing the models package registers every model on Base.metadata
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def ensure_schema() -> None:
    """Run `init_db` exactly once per process (thread-safe, fail-tolerant)."""
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        try:
            init_db()
            logger.info("Database schema ready (%s)", _database_url.split("://")[0])
            _schema_ready = True
        except Exception:
            # Don't block the request — let the real query surface the error
            # (e.g. wrong URL, network problem) with a meaningful message.
            logger.exception("ensure_schema failed; continuing without marking ready")


def get_db() -> Generator[Session, None, None]:
    ensure_schema()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
