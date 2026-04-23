# F1 Race Strategist — Developer Guide

## What Is This Project

A full-stack Formula 1 data visualization and race strategy prediction web app.
Built to demonstrate: ETL pipelines, REST API design, interactive telemetry visualization,
and Monte Carlo race simulation.

**Purpose**: CV/portfolio project showing full-stack engineering + data science skills.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL via Supabase (free tier) — add `DATABASE_URL` to `.env`

### Backend
```bash
# From project root
source venv/Scripts/activate   # Windows Git Bash
# or on PowerShell: venv\Scripts\Activate.ps1

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API docs auto-generated at: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

### Populate Database
```bash
# Basic (2023 Silverstone Race)
python populate_db.py

# Custom race/year
python populate_db.py --year 2023 --gp Monaco --session R
python populate_db.py --year 2024 --gp "Bahrain" --session Q

# Reset schema (drop + recreate, preserves Drivers table)
python reset_db.py
```

---

## Project Structure

```
f1-race-strategist/
├── main.py              # FastAPI app — all REST endpoints
├── models.py            # SQLAlchemy ORM models (Race, Driver, Telemetry)
├── database.py          # DB connection setup (Supabase PostgreSQL)
├── populate_db.py       # ETL pipeline: FastF1 → PostgreSQL
├── reset_db.py          # Drop + recreate schema utility
├── docs/
│   ├── product_prd.md   # Product requirements document
│   ├── architecture.md  # Technology decision rationale
│   └── algorithms.md    # Prediction engine algorithm explainer
└── frontend/
    ├── app/
    │   ├── layout.tsx               # Root layout + metadata
    │   ├── page.tsx                 # Race calendar home page (Server Component)
    │   ├── error.tsx                # Global error boundary
    │   ├── loading.tsx              # Global loading skeleton
    │   └── race/[id]/
    │       ├── page.tsx             # Race detail (Server Component)
    │       ├── RaceView.tsx         # Interactive viewer (Client Component)
    │       ├── error.tsx            # Route-level error boundary
    │       └── loading.tsx          # Race page skeleton
    ├── components/
    │   ├── track/
    │   │   ├── TrackCanvas.tsx      # SVG circuit map + car dots
    │   │   ├── PlaybackControls.tsx # Play/pause/seek bar
    │   │   └── Leaderboard.tsx      # Live standings table
    │   └── ui/
    │       └── BackendStatus.tsx    # Real-time backend health dot
    ├── hooks/
    │   ├── useRacePlayback.ts       # Frame-index playback state
    │   └── useBackendStatus.ts      # Polls /api/health every 30s
    ├── lib/
    │   ├── api.ts                   # All typed API fetch functions
    │   ├── constants.ts             # API_BASE, TEAM_COLORS, teamColor()
    │   └── trackMath.ts             # Coordinate normalisation utilities
    └── types/
        └── index.ts                 # Shared TypeScript interfaces
```

---

## API Reference

All endpoints documented at http://localhost:8000/docs (Swagger UI).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend + DB connectivity check |
| GET | `/api/races` | List all seeded races |
| GET | `/api/races/{id}` | Single race by ID |
| GET | `/api/telemetry/fastest/{race_id}` | Fastest-lap ghost race telemetry |
| GET | `/api/telemetry/full_race/{race_id}` | Full-race (1s resampled) telemetry |

---

## Database Schema

```
races       id, year, grand_prix, session, race_date
drivers     id, abbreviation (3-char unique), name, team
telemetry   id, race_id→races, driver_id→drivers,
            lap_number, is_fastest_lap,
            session_time (float seconds), total_distance,
            time (ms), speed, gear, x_coordinate, y_coordinate
```

**Important time semantics:**
- `is_fastest_lap=True` rows: `session_time` is **lap-relative** (0 = start of that lap).
- `is_fastest_lap=False` rows: `session_time` is **session-relative** (absolute seconds since session start).
- Both live in the same column by design — the `is_fastest_lap` flag tells you which interpretation applies.

---

## Coding Standards

### Python (backend)
- PEP 8 formatting
- Type hints on all function signatures
- Keep ETL logic in `populate_db.py`, HTTP logic in `main.py`
- Use SQLAlchemy `joinedload` for any query that accesses related models

### TypeScript (frontend)
- Strict mode enabled — no `any`
- Named exports for all components and hooks
- All API calls go through `lib/api.ts` — no raw `fetch` in page components
- All shared types live in `frontend/types/index.ts`
- Server Components fetch data; Client Components handle interactivity

### General
- No magic numbers — use `lib/constants.ts` (frontend) or module-level constants (Python)
- No comments explaining *what* — only comments explaining *why* (hidden constraints, non-obvious invariants)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL=postgresql://user:password@host:5432/postgres?sslmode=require
```

Supabase connection string format: Project Settings → Database → Connection string (URI).

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `connection refused` on startup | Backend not running | Run `uvicorn main:app --reload --port 8000` |
| `pick_driver deprecated` warnings | Old FastF1 API | Use `pick_drivers` (plural) — already fixed |
| Empty telemetry response | DB not seeded | Run `python populate_db.py` |
| `SSL connection has been closed` | Supabase idle timeout | Handled by `pool_recycle=280` in database.py |
| `Module not found @/types` | Running outside frontend dir | Run `npm run dev` from the `frontend/` directory |

---

## Feature Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Bug fixes + code organisation | ✅ Done |
| 1 | Data analysis dashboard (lap charts, tire deg, pit timeline) | Planned |
| 2 | Race prediction engine (Monte Carlo simulation) | Planned |

See `docs/product_prd.md` for detailed requirements per phase.
See `docs/algorithms.md` for the prediction engine algorithm explanation.
