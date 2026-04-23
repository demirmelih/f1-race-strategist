# Product Requirements Document — F1 Race Strategist

**Version**: 1.0  
**Author**: Melih Demir  
**Date**: 2026-04-23  

---

## Problem Statement

Formula 1 strategy is opaque to fans. Decisions like tire compound choice, pit stop timing,
and starting position profoundly affect race outcomes — but the reasoning is hidden inside
team radio and engineer spreadsheets. This tool makes strategy **visible and interactive**.

---

## Vision

A web application where users can:
1. **Watch** F1 races replay on the actual circuit map with live telemetry
2. **Analyze** driver performance through lap time, tire, and sector data
3. **Predict** race outcomes by tweaking weather, compound, and starting grid

The combination makes this a genuinely educational F1 tool, not just a data dashboard.

---

## Target User

Technical audience comfortable with data:
- Software engineers who are F1 fans
- Data science students looking for interesting datasets
- Portfolio reviewers evaluating full-stack + data science skills

---

## Phase 0 — Core Viewer (Complete)

### Goal
Fix all bugs and establish clean code architecture.

### Features
- Race calendar showing all seeded sessions
- Fastest-lap ghost race: all 20 drivers animated simultaneously on circuit SVG
- Full-race playback: car positions across the entire race
- Live leaderboard sorted by distance traveled
- Play/pause/seek controls
- Real backend connectivity indicator (polls `/api/health`)

### Acceptance Criteria
- [ ] Browser tab shows "F1 Race Strategist" (not default Next.js title)
- [ ] Backend status dot reflects actual connectivity (green/yellow/red)
- [ ] `GET /api/races/1` returns single race JSON without fetching all races
- [ ] `python populate_db.py --year 2023 --gp Monaco --session R` runs without deprecation warnings
- [ ] TypeScript `npm run build` passes with zero errors
- [ ] Race page shows error skeleton (not crash) when backend is offline

---

## Phase 1 — Data Analysis Dashboard

### Goal
Add quantitative lap and strategy analysis on top of the visual replay.

### User Stories
- As a user, I want to **compare lap times** across all drivers to see who was fastest at which point in the race
- As a user, I want to see **speed and gear traces** overlaid for two drivers on the same lap, to understand where they gain or lose time
- As a user, I want to see **tire degradation curves** to understand how each compound performs over a stint
- As a user, I want a **pit stop strategy timeline** to see how different strategies played out

### New Data Model: `LapSummary`

```sql
lap_summaries:
  id, race_id, driver_id, lap_number
  lap_time_seconds     -- NULL for DNF/SC laps
  compound             -- SOFT / MEDIUM / HARD / INTER / WET
  tyre_life            -- laps on this set
  sector1_time, sector2_time, sector3_time   -- individual sector times
  pit_in_lap           -- boolean
  pit_out_lap          -- boolean
  is_personal_best     -- boolean
  position             -- track position at end of lap
```

Populated during ETL from `session.laps` FastF1 DataFrame.

### New API Endpoints
- `GET /api/laps/{race_id}` — all LapSummary rows for a race
- `GET /api/laps/{race_id}/{driver_id}` — single driver lap data

### New Frontend Components
| Component | Library | Purpose |
|-----------|---------|---------|
| `LapTimeChart` | recharts | Line chart, one series per driver, x=lap, y=time |
| `TelemetryTraceOverlay` | recharts | Speed/gear vs distance, multi-driver |
| `TireDegradationChart` | SVG + pure TS | Scatter + linear regression line |
| `PitStopTimeline` | SVG | Gantt-style timeline, compound-colored segments |

### New Route
`/analysis/[id]` — four-tab analysis view for a given race

### Acceptance Criteria
- [ ] Lap time chart shows all drivers with correct colors
- [ ] Tire degradation chart shows linear regression with slope in ms/lap
- [ ] Pit stop timeline correctly shows compound switches and pit windows
- [ ] Charts are responsive and work on laptop screens (min 1024px wide)

---

## Phase 2 — Race Prediction Engine

### Goal
Build a configurable Monte Carlo race simulator with an animated UI.

### User Stories
- As a user, I want to **set the weather** (Dry/Mixed/Wet) and see how it affects predicted outcomes
- As a user, I want to **choose starting tire compounds** for each driver and see how strategy affects finishing positions
- As a user, I want to **move drivers on the grid** (e.g., put Hamilton in P1) and see how that changes win probability
- As a user, I want to see **probability distributions** (e.g., "Verstappen wins in 67% of simulations")
- As a user, I want to see the **predicted finishing order animate** as cars move to their positions

### Backend: `prediction/` Package

```
prediction/
├── pace_model.py    -- compute driver pace distribution from LapSummary data
├── tire_model.py    -- compound degradation rates and base deltas
├── weather_model.py -- pace multipliers per weather condition
└── simulator.py     -- Monte Carlo engine (500–1000 runs)
```

**Algorithm overview** (detailed in `docs/algorithms.md`):
1. Compute `base_pace ± std` per driver from their clean-air median lap times
2. For each simulation run, simulate lap-by-lap:
   - `lap_time = base_pace + compound_delta + deg_rate × tyre_life + N(0, std) × weather_mult`
3. Sum cumulative times → finishing order
4. Aggregate 500 runs → probability distribution

### New API Endpoint
```
POST /api/predict/race
Body: { race_id, weather, compound, grid_overrides, n_simulations }
Response: { results: [{driver, predicted_position, win_probability, gap_to_leader}] }
```

### New Frontend Components
| Component | Purpose |
|-----------|---------|
| `PredictionConfig` | Weather cards, compound buttons, grid position inputs |
| `PredictionResult` | Framer Motion animated finishing order + probability bars |
| `CompoundBadge` | Colored compound indicator (Soft=red, Medium=yellow, etc.) |

### New Route
`/predict/[id]` — two-panel prediction view

### Acceptance Criteria
- [ ] Selecting "Wet" weather produces noticeably different results than "Dry"
- [ ] Changing compound from Soft to Hard increases predicted lap times
- [ ] Results animate smoothly when the "Simulate" button is clicked
- [ ] 500-simulation run completes in under 2 seconds
- [ ] Win probability bars sum to ~100% across all drivers

---

## Technical Requirements

| Requirement | Target |
|-------------|--------|
| Initial page load | < 1.5s (server-rendered) |
| Telemetry endpoint | < 500ms for a single race |
| Prediction endpoint | < 2s for 500 simulations |
| Supported browsers | Chrome, Firefox, Safari (last 2 major versions) |
| Minimum viewport | 1024px wide (desktop-first) |
| Data freshness | Seeded on demand via CLI; no real-time data |

---

## Out of Scope (for now)

- Real-time live timing (F1 live API is restricted)
- User accounts or saved predictions
- Mobile-first layout
- Weather data from actual race telemetry (using hardcoded pace modifiers)
- Modelling safety cars, crashes, or reliability failures

---

## Data Sources

All data sourced from [FastF1](https://theoehrly.github.io/Fast-F1/), an unofficial
Python library that accesses ergast.com and F1's own timing data. Data is cached locally
in `f1_cache/` to avoid repeated API calls.

**Why FastF1?** It provides structured lap-by-lap telemetry (GPS coordinates, speed, gear,
sector times) for every driver in every session since 2018. No API key required for
historical data.

---

## CV Talking Points

This project demonstrates:
1. **ETL pipeline design** — FastF1 → pandas transformation → PostgreSQL with idempotent upserts
2. **REST API design** — FastAPI, Pydantic schemas, eager loading with SQLAlchemy `joinedload`
3. **Full-stack TypeScript** — Next.js App Router, server/client component split, shared types
4. **SVG data visualization** — coordinate normalization, real-time animation with React state
5. **Statistical modeling** — linear regression from scratch, Monte Carlo simulation, Gaussian noise
6. **System design** — configurable parameters flowing API → simulation → animated UI
7. **Clean architecture** — separation of concerns, shared types, centralized API client
