# Health Data Extract

A production-minded MVP that lets you upload medical PDF orders, extract the patient's
**first name**, **last name**, and **date of birth**, and manage the resulting **Order**
records via a REST API. Every API request is logged to a database for auditing.

- **Backend:** FastAPI (Python 3.11+), SQLAlchemy 2.0, Pydantic v2, slowapi
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Database:** SQLite locally, Postgres in production (any Postgres URL works — Vercel Postgres / Neon / Supabase / RDS)
- **PDF extraction:** `pdfplumber` / `pypdf` for text; **OpenAI GPT-5.4 vision** for scanned PDFs (10M-pixel image input, frontier multimodal accuracy); regex heuristics as a final fallback
- **Deploy:** Vercel (single project: Python serverless function + static React build)

> **Note on the original brief:** the brief asked for Drizzle ORM, which is TypeScript-only and incompatible with a Python backend. SQLAlchemy 2.0 (with declarative typed mappings + Pydantic schemas) is the equivalent best-practice in Python and is used throughout.

---

## Repository layout

```
.
├── api/                     # Vercel Python serverless entry point
│   ├── index.py             # imports backend.app.main:app
│   └── requirements.txt     # runtime deps installed by Vercel
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── routes/      # HTTP routes (orders, extractions, activity-logs, health)
│   │   │   └── controllers/ # Route -> repo / service glue layer
│   │   ├── core/            # Config, logging, security
│   │   ├── db/              # SQLAlchemy engine + session
│   │   ├── middleware/      # CORS, request-id, activity logging, error handlers, rate limit
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── repositories/    # Persistence layer (Protocol + SQLAlchemy impl per aggregate)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (PDF text extraction, LLM orchestration)
│   │   └── main.py          # FastAPI app factory
│   ├── tests/               # pytest suite (unit + integration)
│   ├── requirements-dev.txt # local-dev deps (uvicorn, pdfplumber, pytest...)
│   └── .env.example
├── frontend/                # React + TS + Vite app
│   ├── src/
│   │   ├── components/      # OrdersPanel, UploadPanel, ActivityPanel, SettingsPanel
│   │   ├── lib/api.ts       # Typed API client
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── vercel.json              # Vercel build + routing config
└── README.md
```

---

## Endpoints

All endpoints are versioned under `/api/v1`. Set `X-API-Key` (when `REQUIRE_AUTH=true`).

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/health` | Liveness check |
| GET    | `/api/v1/health/db` | Database connectivity check |
| POST   | `/api/v1/orders` | Create an order |
| GET    | `/api/v1/orders` | List orders (`limit`, `offset`, `status`, `search`) |
| GET    | `/api/v1/orders/{id}` | Get one order |
| PATCH  | `/api/v1/orders/{id}` | Update an order |
| DELETE | `/api/v1/orders/{id}` | Delete an order |
| POST   | `/api/v1/extractions/pdf` | Upload PDF, extract patient info; optional `create_order=true` to persist as an Order |
| GET    | `/api/v1/activity-logs` | View audit log of API requests |
| GET    | `/docs` | Interactive Swagger UI |
| GET    | `/redoc` | ReDoc UI |

### Error envelope

Every error response uses a consistent shape:

```json
{
  "error": {
    "type": "validation_error",
    "message": "Request validation failed",
    "status_code": 422,
    "details": [...],
    "request_id": "9b1f..."
  }
}
```

---

## Local development

### Prerequisites
- Python 3.11+ (3.14 tested)
- Node 18+

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt    # dev: includes uvicorn, pdfplumber, pytest
cp .env.example .env  # then edit
uvicorn app.main:app --reload --port 8000
```

The API is now at <http://localhost:8000>, docs at <http://localhost:8000/docs>.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on <http://localhost:5173> and proxies `/api/*` to the backend on `:8000` (see `vite.config.ts`).

### 3. Tests

```bash
cd backend
pytest -v
```

The suite uses an in-memory SQLite DB and synthesises minimal PDFs on the fly so it runs without external dependencies or an OpenAI key.

### 4. Local Postgres (recommended — matches production)

A `docker-compose.yml` is included so you can run the same Postgres locally that you'll deploy against. Port `5433` is used to avoid clashing with any existing Postgres on `5432`.

```bash
# Start Postgres in the background
docker compose up -d postgres

# Wait until healthy (usually a few seconds)
docker inspect -f '{{.State.Health.Status}}' hde-postgres

# Point the API at it
export DATABASE_URL="postgresql+psycopg://hde:hde@localhost:5433/health_data"
cd backend && uvicorn app.main:app --reload --port 8000

# (Optional) bring up the Adminer DB browser at http://localhost:8081
docker compose --profile ui up -d adminer

# Tear down (data persists in the named volume)
docker compose down

# Wipe the data volume too
docker compose down -v
```

You can verify the API actually wrote to Postgres with:

```bash
docker exec hde-postgres psql -U hde -d health_data -c "SELECT * FROM orders;"
docker exec hde-postgres psql -U hde -d health_data -c "SELECT method, path, status_code FROM activity_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## Configuration

Environment variables (see `backend/.env.example`):

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `sqlite:///./health_data.db` | Use `postgresql+psycopg://...` in production |
| `REQUIRE_AUTH` | `true` | Set to `false` for open dev |
| `API_KEY` | `dev-api-key-change-me` | Sent as `X-API-Key` header |
| `CORS_ORIGINS` | `*` | Comma-separated origins |
| `RATE_LIMIT_DEFAULT` | `60/minute` | Per IP/key default rate limit |
| `RATE_LIMIT_UPLOAD` | `10/minute` | Stricter limit for the PDF endpoint |
| `MAX_UPLOAD_SIZE_MB` | `10` | Reject uploads larger than this |
| `OPENAI_API_KEY` | _empty_ | Required for high-accuracy extraction (text & vision) |
| `OPENAI_MODEL` | `gpt-5.4` | Frontier multimodal model (released 2026-03-05). Use `gpt-5.4-mini` for cheaper/faster extractions, or `gpt-4o-mini` to fall back to legacy non-reasoning models |
| `OPENAI_REASONING_EFFORT` | `low` | One of `none`, `low`, `medium`, `high`, `xhigh`. Only applied to GPT-5.x / o-series models |

---

## Deployment to Vercel

This repo is a single Vercel project that ships:
- A **Python serverless function** at `api/index.py` (FastAPI)
- A **static React build** at `frontend/dist/`

`vercel.json` rewrites `/api/*`, `/docs`, `/redoc`, and `/openapi.json` to the Python function; everything else is served from the static build.

### One-time setup

1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the repo. Vercel will auto-detect `vercel.json`.
3. Provision a Postgres database (Vercel Postgres, Neon, Supabase, etc.) and add it as `DATABASE_URL` in **Project → Settings → Environment Variables**:
   ```
   postgresql+psycopg://USER:PASS@HOST:5432/DBNAME?sslmode=require
   ```
4. Add the rest of the env vars:
   - `API_KEY` — pick something secret
   - `REQUIRE_AUTH=true`
   - `CORS_ORIGINS=https://<your-vercel-domain>.vercel.app`
   - `OPENAI_API_KEY` — for vision-based extraction on scanned PDFs
   - `ENVIRONMENT=production`
5. Deploy.

> The first request after a cold start will create the tables via `Base.metadata.create_all()`.
> For schema migrations under heavier production load, swap in Alembic — the project is structured so that `from app.db.session import Base` already exposes the metadata.

### SQLite on Vercel

Vercel's filesystem is read-only except `/tmp`, which is also ephemeral. If you leave `DATABASE_URL` as SQLite, the entry point will redirect it to `/tmp/health_data.db` so the API works, **but data will not persist across cold starts**. Use Postgres for any real data.

### Verifying the deployment

```bash
curl https://<your-domain>.vercel.app/api/v1/health
curl -H "X-API-Key: $API_KEY" https://<your-domain>.vercel.app/api/v1/orders
curl -H "X-API-Key: $API_KEY" \
     -F "file=@sample.pdf;type=application/pdf" \
     -F "create_order=true" \
     https://<your-domain>.vercel.app/api/v1/extractions/pdf
```

---

## How extraction works

1. **Text extraction.** `pdfplumber` is tried first; `pypdf` is a fallback.
2. **If the PDF has text:** the text is sent to **GPT-5.4** (chat completions, strict JSON output, `reasoning_effort=low`). If that fails or the key isn't set, regex heuristics extract `Patient Name:`, `First/Last Name:`, `DOB:` style fields.
3. **If the PDF has no text** (e.g. scanned): the first 4 pages are rendered to PNG with `pypdfium2` at scale=3.0 (~216 DPI) and sent to GPT-5.4's vision API. GPT-5.4 accepts images up to 10M pixels uncompressed, which preserves the small print on medical scans where lower-resolution OCR would lose patient details.
4. **Confidence** (`high` / `medium` / `low`) and **source** (`llm` / `llm_vision` / `regex`) are returned alongside the extracted fields so the caller can decide what to do.

The code automatically detects whether the configured model is a reasoning model (GPT-5.x / o-series) and uses the appropriate API parameters (`max_completion_tokens` + `reasoning_effort` vs legacy `max_tokens` + `temperature`), so you can switch between `gpt-5.4`, `gpt-5.4-mini`, or older models like `gpt-4o-mini` purely via env var.

This layered approach means the endpoint always returns a useful response — rich JSON with whatever fields could be confidently identified — and never crashes on a scanned or oddly formatted document.

---

## Production considerations included

- **Versioned API** under `/api/v1`
- **Routes / controllers / services / models / schemas** separation of concerns
- **Pydantic v2 request validation** with custom validators (e.g. blank names, future DOBs)
- **Consistent JSON error envelope** for HTTP, validation, and unhandled errors
- **API-key authentication** via `X-API-Key` header (toggleable for dev/test)
- **Per-key/IP rate limiting** (`slowapi`) with stricter limits on the upload endpoint
- **CORS** with explicit origin allowlist
- **Request-ID middleware** that adds `X-Request-ID` and `X-Response-Time-ms` headers
- **Activity logging middleware** that persists every API request (method, path, status, duration, actor, IP, request-id) to a queryable endpoint
- **Upload validation** (mime type, magic bytes, size cap)
- **LLM error handling** with timeouts, retries, and graceful regex fallback
- **Unit + integration tests** (in-memory SQLite, synthetic PDFs, no external services needed)
- **Single-command Vercel deploy** with environment-driven configuration

---

## What I would add next

- Alembic migrations (currently using `create_all` for MVP simplicity)
- A real auth system (JWT + user table) instead of a single API key
- Background processing of large PDFs (currently synchronous; would move to a queue)
- Caching layer for repeated identical PDFs (hash-based dedupe of extractions)
- Structured JSON logging shipped to a log aggregator
- E2E tests with Playwright for the React app
