"""Vercel Python serverless entry point.

Vercel runs this file as a serverless function. We add the project root to sys.path
so the FastAPI application package under ./backend/app can be imported.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

# Vercel filesystem is read-only except /tmp. If a SQLite URL is configured but we're
# on Vercel, redirect it to /tmp so the DB at least works for the lifetime of the
# instance (it will not persist across cold starts; use Postgres for production data).
if os.getenv("VERCEL") and os.getenv("DATABASE_URL", "").startswith("sqlite"):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/health_data.db"

from app.main import app  # noqa: E402

# Vercel's Python runtime looks for an ASGI/WSGI variable named `app` (or `handler`).
# FastAPI is ASGI, which Vercel's @vercel/python runtime supports natively.
