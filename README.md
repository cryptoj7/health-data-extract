# Health Data Extract

A production-minded MVP that lets you upload medical PDF orders, extract the **patient's identity** (first name, last name, DOB) plus the **full document context** (prescriber, NPI, diagnoses, ordered items, addresses, dates), and manage the resulting **Order** records via a REST API. Patients are first-class entities — orders for the same person collapse to a single patient row. Every API request is logged to a database for auditing.

- **Backend:** FastAPI (Python 3.12+), SQLAlchemy 2.0, Pydantic v2, slowapi
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4, with `pdfjs-dist` for inline PDF preview
- **Database:** SQLite locally, Postgres in production (any provider — Neon / Supabase / Vercel / RDS — with auto-normalisation of the URL prefix)
- **PDF extraction:** Direct PDF input via **OpenAI GPT-5.4 Responses API** for vision-grade extraction of scanned and digital PDFs; `pypdf` for the cheap text-only path; regex heuristics as a final fallback
- **Deploy:** Vercel (single project: Python serverless function + static React build) with auto-additive migrations on cold start

> **Note on the original brief:** the brief asked for Drizzle ORM, which is TypeScript-only and incompatible with a Python backend. SQLAlchemy 2.0 (with declarative typed mappings + Pydantic schemas) is the equivalent best-practice in Python and is used throughout.

---

## Repository layout

```
.
├── api/                        # Vercel Python serverless entry point
│   └── index.py                # 25-line shim: imports backend.app.main:app
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── routes/         # HTTP routes (orders, patients, extractions, activity-logs, health)
│   │   │   └── controllers/    # Route -> repo / service glue layer
│   │   ├── core/               # Config, logging, security
│   │   ├── db/                 # SQLAlchemy engine, session, lazy schema init + auto-migration
│   │   ├── middleware/         # CORS, request-id, activity logger, error handlers, rate limit, security headers
│   │   ├── models/             # SQLAlchemy ORM models (Order, Patient, ActivityLog)
│   │   ├── repositories/       # Persistence layer (Protocol + SQLAlchemy impl per aggregate)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (PDF text, LLM orchestration, in-process LRU cache)
│   │   └── main.py             # FastAPI app factory
│   ├── tests/                  # pytest suite — 34 tests, in-memory SQLite, no external services
│   ├── requirements-dev.txt    # local-only deps (uvicorn, pytest, pdfplumber); `-r ../requirements.txt` pulls prod
│   └── .env.example
├── frontend/                   # React + TS + Vite app
│   ├── src/
│   │   ├── components/         # UploadPanel, OrdersPanel, PatientsPanel, ActivityPanel, SettingsPanel,
│   │   │                       #   DocumentDetailsView, PdfPreview
│   │   ├── lib/api.ts          # Typed API client
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── .github/workflows/ci.yml    # CI: pytest + frontend typecheck + production build
├── docker-compose.yml          # Local Postgres (parity with prod)
├── requirements.txt            # PRODUCTION deps — what Vercel installs
├── vercel.json                 # Build + routing + function bundle config
└── README.md
```

---

## Endpoints

All endpoints are versioned under `/api/v1`. Set `X-API-Key` (when `REQUIRE_AUTH=true`).

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/health` | Liveness check |
| GET    | `/api/v1/health/db` | Database connectivity check |
| POST   | `/api/v1/orders` | Create an order (find-or-creates the linked patient) |
| GET    | `/api/v1/orders` | List orders (`limit`, `offset`, `status`, `search`) |
| GET    | `/api/v1/orders/{id}` | Get one order (includes `document_metadata` JSON) |
| PATCH  | `/api/v1/orders/{id}` | Update an order |
| DELETE | `/api/v1/orders/{id}` | Delete an order |
| GET    | `/api/v1/patients` | List patients (search by name, includes `order_count`) |
| GET    | `/api/v1/patients/{id}` | Get one patient |
| GET    | `/api/v1/patients/{id}/orders` | List all orders for a patient |
| POST   | `/api/v1/extractions/pdf` | Upload PDF, extract patient + full document; optional `create_order=true` |
| GET    | `/api/v1/activity-logs` | Audit log (filter by `path_contains`, `action`, `resource_type`, `resource_id`) |
| GET    | `/docs` | Interactive Swagger UI |
| GET    | `/redoc` | ReDoc UI |

### Extraction response shape

`POST /api/v1/extractions/pdf` returns:

```json
{
  "extracted": {
    "first_name": "Marie",
    "last_name": "Curie",
    "date_of_birth": "1900-12-05",
    "confidence": "high",
    "source": "llm_pdf",
    "document": {
      "document_type": "Prescription - Standard Written Order",
      "order_date": "2024-02-30",
      "patient_address": { "line1": "218 Forest Hills Ave", "city": "Boston", "state": "MA", "postal_code": "22180" },
      "prescriber": { "name": "Arjun Raj D.P.M", "npi": "9182734556", "phone": "912-219-2310", "fax": "912-219-2311", "address": {...} },
      "diagnoses": [
        { "code": "M19.071", "description": "Primary osteoarthritis, right ankle and foot" },
        { "code": "M21.6x1", "description": "Other acquired deformities of right foot" }
      ],
      "items": [
        { "code": "L3020", "description": "Custom Molded Longitudinal/Metatarsal Arch Supp", "side": "LT", "quantity": 1 }
      ]
    }
  },
  "raw_text_preview": "...",
  "order_id": "3a564460-0f11-4b95-9b87-68d97a59fc52"
}
```

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
- Python 3.11+ (3.12 used on Vercel; 3.14 tested locally)
- Node 18+

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt    # dev: prod deps + uvicorn, pytest, pdfplumber
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

The frontend runs on <http://localhost:5173> and proxies `/api/*` to the backend on `:8000` (override with `VITE_BACKEND_PORT` or `VITE_BACKEND_URL`). Set `VITE_API_KEY` in `frontend/.env.local` to skip the Settings UI step.

### 3. Tests

```bash
cd backend
pytest -v
```

The suite uses an in-memory SQLite DB and synthesises minimal PDFs on the fly so it runs without external dependencies or an OpenAI key. **34 tests** covering CRUD, validation, repo lifecycle + Protocol conformance, activity-log middleware, security headers, and the extraction cache.

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
docker exec hde-postgres psql -U hde -d health_data -c "SELECT * FROM patients;"
docker exec hde-postgres psql -U hde -d health_data -c "SELECT method, path, action, resource_type, resource_id FROM activity_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## Configuration

Environment variables (see `backend/.env.example`):

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `sqlite:///./health_data.db` | Any of `postgresql://`, `postgres://`, `postgresql+psycopg://` works — auto-normalised to use the psycopg3 driver |
| `REQUIRE_AUTH` | `true` | Set to `false` for open dev |
| `API_KEY` | `dev-api-key-change-me` | Sent as `X-API-Key` header |
| `CORS_ORIGINS` | `*` | Comma-separated origins |
| `RATE_LIMIT_DEFAULT` | `60/minute` | Per-IP/key default rate limit |
| `RATE_LIMIT_UPLOAD` | `10/minute` | Stricter limit for the PDF endpoint |
| `MAX_UPLOAD_SIZE_MB` | `10` | Reject uploads larger than this |
| `OPENAI_API_KEY` | _empty_ | Required for high-accuracy extraction |
| `OPENAI_MODEL` | `gpt-5.4` | Frontier multimodal model (released 2026-03-05). Use `gpt-5.4-mini` for cheaper/faster extractions, or `gpt-4o-mini` to fall back to legacy non-reasoning models |
| `OPENAI_REASONING_EFFORT` | `low` | One of `none`, `low`, `medium`, `high`, `xhigh`. Only applied to GPT-5.x / o-series models |

Frontend env (set in `frontend/.env.local` or in Vercel — both must be `VITE_*` prefixed to be inlined into the client bundle):

| Variable | Notes |
|----------|-------|
| `VITE_API_KEY` | Default API key. Anything saved via the Settings UI overrides it. |
| `VITE_API_BASE_URL` | Default API base URL. Leave blank for same-origin (production). |
| `VITE_BACKEND_PORT` / `VITE_BACKEND_URL` | Local-dev only — controls the Vite proxy target. |

---

## Deployment to Vercel

This repo is a single Vercel project that ships:
- A **Python serverless function** at `api/index.py` (FastAPI)
- A **static React build** at `frontend/dist/`

`vercel.json` rewrites `/api/*`, `/docs`, `/redoc`, and `/openapi.json` to the Python function; everything else is served from the static build. The function bundle is constrained by `functions.api/index.py.includeFiles` (`backend/app/**`) and `excludeFiles` (everything frontend-related, all node_modules, all caches).

### One-time setup

1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the repo. Set **Application Preset** to **Other** (not "Services"). Vercel will use your `vercel.json`.
3. Provision a Postgres database (Neon is the canonical choice — Vercel's "Postgres" offering is now Neon under the hood). Copy its connection string.
4. Add env vars in **Project → Settings → Environment Variables**:
   - `DATABASE_URL` — the Neon connection string. Any prefix works (`postgresql://`, `postgres://`, `postgresql+psycopg://`).
   - `API_KEY` — pick something secret (`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`)
   - `VITE_API_KEY` — same value as `API_KEY` (so the deployed UI works without Settings)
   - `REQUIRE_AUTH=true`
   - `CORS_ORIGINS=https://<your-vercel-domain>.vercel.app`
   - `OPENAI_API_KEY` — for direct-PDF extraction
   - `OPENAI_MODEL=gpt-5.4`
   - `ENVIRONMENT=production`
5. Deploy.

> **About migrations.** The first request after a cold start runs `Base.metadata.create_all()` *and* a small additive helper that runs `ALTER TABLE ADD COLUMN` for any new columns the model declares but the live DB doesn't have. Idempotent, additive-only, works on Postgres + SQLite. For destructive schema changes you'd want real Alembic migrations.

### SQLite on Vercel

Vercel's filesystem is read-only except `/tmp`, which is also ephemeral. If you leave `DATABASE_URL` as SQLite, the entry point will redirect it to `/tmp/health_data.db` so the API works, **but data will not persist across cold starts**. Use Postgres for any real data.

### Verifying the deployment

```bash
curl https://<your-domain>.vercel.app/api/v1/health
curl -H "X-API-Key: $API_KEY" https://<your-domain>.vercel.app/api/v1/health/db
curl -H "X-API-Key: $API_KEY" https://<your-domain>.vercel.app/api/v1/orders
curl -H "X-API-Key: $API_KEY" \
     -F "file=@sample.pdf;type=application/pdf" \
     -F "create_order=true" \
     https://<your-domain>.vercel.app/api/v1/extractions/pdf
```

---

## How extraction works

1. **Content-hash dedupe.** SHA-256 the upload bytes; if we've already extracted this exact file in this warm container, return the cached result and tag `source` with a `+cache` suffix. Saves an LLM round-trip on repeat uploads.
2. **Text extraction.** `pdfplumber` is tried first when available (local dev only); `pypdf` is the production fallback. Result is also returned in `raw_text_preview` for debugging.
3. **If the PDF has text:** the text is sent to **GPT-5.4** via `chat.completions` with strict JSON output and `reasoning_effort=low` — the cheapest path. If that fails or no key is set, regex heuristics extract `Patient Name:`, `First/Last Name:`, `DOB:` style fields.
4. **If the PDF has no text** (e.g. scanned): the PDF bytes are sent **directly to GPT-5.4 via the Responses API** as an `input_file` part. The model handles OCR + page-image extraction server-side, so we don't render anything ourselves — keeps the serverless function bundle small (no `pypdfium2`, no `Pillow`) and lets the model see the entire document at native resolution.
5. **Confidence** (`high` / `medium` / `low`) and **source** (`llm` / `llm_pdf` / `regex`, with optional `+cache` suffix) are returned alongside the extracted fields so the caller can decide what to do.

The same JSON schema is requested in both LLM paths and includes the full document: patient address, prescriber identity (name, NPI, phone, fax, address), diagnoses (with ICD-10 codes), ordered items (with HCPCS codes, side, quantity), order date, and document type. The rich extraction is persisted to `Order.document_metadata` (JSON column) so it stays queryable later.

The extraction code automatically detects whether the configured model is a reasoning model (GPT-5.x / o-series) and uses the appropriate API parameters (`max_completion_tokens` + `reasoning_effort` vs legacy `max_tokens` + `temperature`), so you can switch between `gpt-5.4`, `gpt-5.4-mini`, or older models like `gpt-4o-mini` purely via env var.

This layered approach means the endpoint always returns a useful response — rich JSON with whatever fields could be confidently identified — and never crashes on a scanned or oddly formatted document.

---

## Production considerations included

- **Versioned API** under `/api/v1`
- **Routes / controllers / repositories / services / models / schemas** — strict separation of concerns; repositories expose `Protocol` interfaces so the persistence backend is swappable for tests
- **Patient as a first-class entity** with `find_or_create` semantics (case-insensitive `(first, last, dob)` uniqueness) and `Order.patient_id` FK; same person across orders collapses to one row
- **Rich document extraction** (prescriber, NPI, ICD-10 diagnoses, ordered items, addresses) stored as JSON on the order
- **Pydantic v2 request validation** with custom validators (e.g. blank names, future DOBs)
- **Consistent JSON error envelope** for HTTP, validation, and unhandled errors — every response carries `X-Request-ID` for tracing
- **API-key authentication** via `X-API-Key` header (toggleable for dev/test)
- **Per-key/IP rate limiting** (`slowapi`) with stricter limits on the upload endpoint
- **CORS** with explicit origin allowlist
- **Security headers middleware** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` on TLS only)
- **Activity logging middleware** that persists every API request with both HTTP fields (method, path, status, duration, IP) AND semantic fields (`action`, `resource_type`, `resource_id`) — so audit queries can be domain-driven, not just URL substring searches
- **Upload validation** (mime type, magic bytes, size cap)
- **Content-hash extraction cache** — repeat uploads of the same PDF skip the LLM round-trip
- **LLM error handling** with timeouts, retries, and graceful regex fallback
- **Lazy schema initialisation** that works around Vercel's ASGI lifespan quirks (tables auto-create on first DB-touching request per warm container) **plus additive auto-migrations** for new columns
- **Postgres URL normaliser** — accepts any provider's default URL form and adds the psycopg3 driver suffix; disables prepared statements for pgBouncer-mode pooled connections (Neon, Supabase, RDS Proxy)
- **Inline PDF preview** in the upload UI side-by-side with the extraction result, rendered with `pdfjs-dist`
- **Unit + integration tests** (in-memory SQLite, synthetic PDFs, no external services needed) — CI runs them on every push via `.github/workflows/ci.yml`
- **Single-command Vercel deploy** with environment-driven configuration

---

## What I would add next

- Alembic migrations (currently using `create_all` + an additive auto-migrator for MVP simplicity)
- A real auth system (JWT + user table) instead of a single API key
- Background processing of large PDFs (currently synchronous; would move to a queue)
- Shared cache (Redis) instead of the in-process LRU — survives cold starts and shares across function instances
- Structured JSON logging shipped to a log aggregator
- E2E tests with Playwright for the React app (currently used ad-hoc for screenshot review)
