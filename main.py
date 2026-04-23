"""
main.py — F1 Race Strategist API

Data is served from PostgreSQL (via SQLAlchemy).
Use populate_db.py to seed the database with fastf1 data first.
"""

from typing import Generator, List, Optional

import sqlalchemy as sa
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import Base, SessionLocal, engine
import models  # noqa: F401 – registers all ORM models with Base.metadata

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = FastAPI(
    title="F1 Race Strategist API",
    description=(
        "Serves F1 telemetry data from a PostgreSQL database. "
        "Populate the DB first with populate_db.py."
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup: ensure tables exist
# ---------------------------------------------------------------------------
@app.on_event("startup")
def create_tables() -> None:
    """Create all SQLAlchemy-managed tables if they don't already exist."""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created / verified successfully.")
    except Exception as exc:
        print(f"⚠️  Could not reach database on startup: {exc}")
        print("   The server will still run; DB-dependent endpoints may fail.")


# ---------------------------------------------------------------------------
# Database dependency
# ---------------------------------------------------------------------------
def get_db() -> Generator:
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pydantic response schemas
# ---------------------------------------------------------------------------
class RaceResponse(BaseModel):
    id: int
    year: int
    grand_prix: str
    session: str
    race_date: Optional[str] = None
    model_config = {"from_attributes": True}


class TelemetryResponse(BaseModel):
    id: int
    race_id: int
    driver_id: int
    driver_abbreviation: Optional[str] = None
    driver_team: Optional[str] = None
    lap_number: int
    is_fastest_lap: bool
    session_time: float
    total_distance: float
    time: float
    speed: int
    gear: int
    x_coordinate: float
    y_coordinate: float
    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    status: str
    db: str


# ---------------------------------------------------------------------------
# Helper: map telemetry ORM rows to response dicts
# Uses eager-loaded driver relationship (joinedload applied at query time).
# ---------------------------------------------------------------------------
def _enrich_rows(rows: List[models.Telemetry]) -> List[dict]:
    return [
        {
            "id": row.id,
            "race_id": row.race_id,
            "driver_id": row.driver_id,
            "driver_abbreviation": row.driver.abbreviation if row.driver else None,
            "driver_team": row.driver.team if row.driver else None,
            "lap_number": row.lap_number,
            "is_fastest_lap": row.is_fastest_lap,
            "session_time": row.session_time,
            "total_distance": row.total_distance,
            "time": row.time,
            "speed": row.speed,
            "gear": row.gear,
            "x_coordinate": row.x_coordinate,
            "y_coordinate": row.y_coordinate,
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Backend and database health check",
)
def health_check(db: Session = Depends(get_db)) -> dict:
    """Returns 200 if the API and database are reachable, 503 otherwise."""
    try:
        db.execute(sa.text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {exc}")


@app.get(
    "/api/races",
    response_model=List[RaceResponse],
    summary="List all available races",
)
def list_races(db: Session = Depends(get_db)) -> List[dict]:
    races = db.query(models.Race).all()
    return [
        {
            "id": r.id,
            "year": r.year,
            "grand_prix": r.grand_prix,
            "session": r.session,
            "race_date": r.race_date.isoformat() if r.race_date else None,
        }
        for r in races
    ]


@app.get(
    "/api/races/{race_id}",
    response_model=RaceResponse,
    summary="Get a single race by ID",
)
def get_race(race_id: int, db: Session = Depends(get_db)) -> dict:
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if race is None:
        raise HTTPException(status_code=404, detail=f"Race {race_id} not found.")
    return {
        "id": race.id,
        "year": race.year,
        "grand_prix": race.grand_prix,
        "session": race.session,
        "race_date": race.race_date.isoformat() if race.race_date else None,
    }


@app.get(
    "/api/telemetry/fastest/{race_id}",
    response_model=List[TelemetryResponse],
    summary="Fastest-lap telemetry for every driver in a race",
)
def get_fastest_lap_telemetry(
    race_id: int,
    db: Session = Depends(get_db),
) -> List[dict]:
    """All drivers' single-fastest-lap telemetry for the given race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if race is None:
        raise HTTPException(status_code=404, detail=f"Race {race_id} not found.")

    rows = (
        db.query(models.Telemetry)
        .options(joinedload(models.Telemetry.driver))
        .filter(
            models.Telemetry.race_id == race_id,
            models.Telemetry.is_fastest_lap == True,  # noqa: E712
        )
        .order_by(models.Telemetry.driver_id, models.Telemetry.session_time)
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No fastest-lap telemetry for race {race_id}.",
        )
    return _enrich_rows(rows)


@app.get(
    "/api/telemetry/full_race/{race_id}",
    response_model=List[TelemetryResponse],
    summary="Full-race (downsampled) telemetry for every driver",
)
def get_full_race_telemetry(
    race_id: int,
    db: Session = Depends(get_db),
) -> List[dict]:
    """Downsampled full-race telemetry for every driver in the given race."""
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if race is None:
        raise HTTPException(status_code=404, detail=f"Race {race_id} not found.")

    rows = (
        db.query(models.Telemetry)
        .options(joinedload(models.Telemetry.driver))
        .filter(
            models.Telemetry.race_id == race_id,
            models.Telemetry.is_fastest_lap == False,  # noqa: E712
        )
        .order_by(models.Telemetry.driver_id, models.Telemetry.session_time)
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No full-race telemetry for race {race_id}.",
        )
    return _enrich_rows(rows)


# Legacy endpoint — kept for backwards compatibility
@app.get(
    "/api/telemetry/{race_id}/{driver_id}",
    response_model=List[TelemetryResponse],
    summary="Telemetry for a specific race and driver",
)
def get_telemetry(
    race_id: int,
    driver_id: int,
    db: Session = Depends(get_db),
) -> List[dict]:
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if race is None:
        raise HTTPException(status_code=404, detail=f"Race {race_id} not found.")

    driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    if driver is None:
        raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found.")

    rows = (
        db.query(models.Telemetry)
        .options(joinedload(models.Telemetry.driver))
        .filter(
            models.Telemetry.race_id == race_id,
            models.Telemetry.driver_id == driver_id,
        )
        .order_by(models.Telemetry.session_time)
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No telemetry for race {race_id}, driver {driver_id}.",
        )
    return _enrich_rows(rows)


# To run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
