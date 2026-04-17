"""Persist a record of every API request to the database."""
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db.session import SessionLocal
from app.repositories.activity_log_repository import ActivityLogRepository

logger = logging.getLogger(__name__)


# Paths we don't want to clutter the activity log with
_SKIP_PATHS = {"/health", "/api/v1/health", "/", "/favicon.ico", "/docs", "/openapi.json", "/redoc"}


class ActivityLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        error_message: str | None = None
        status_code = 500
        response: Response | None = None

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            error_message = f"{type(exc).__name__}: {exc}"
            raise
        finally:
            duration_ms = int((time.perf_counter() - start) * 1000)
            path = request.url.path

            if path not in _SKIP_PATHS and not path.startswith(("/static", "/_next")):
                try:
                    actor = request.headers.get("X-API-Key")
                    actor_label = "api-key" if actor else "anonymous"
                    client_ip = request.client.host if request.client else None
                    forwarded_for = request.headers.get("x-forwarded-for")
                    if forwarded_for:
                        client_ip = forwarded_for.split(",")[0].strip()

                    request_id = getattr(request.state, "request_id", None)

                    db = SessionLocal()
                    try:
                        ActivityLogRepository(db).create(
                            method=request.method,
                            path=path,
                            status_code=status_code,
                            duration_ms=duration_ms,
                            actor=actor_label,
                            client_ip=client_ip,
                            user_agent=request.headers.get("user-agent"),
                            request_id=request_id,
                            error_message=error_message,
                        )
                    finally:
                        db.close()
                except Exception as log_err:  # pragma: no cover
                    logger.warning("Failed to persist activity log: %s", log_err)
