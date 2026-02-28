"""
main.py — F1 Race Strategist API

Data is served from PostgreSQL (via SQLAlchemy).
Use populate_db.py to seed the database with fastf1 data first.
"""

from typing import Generator, List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

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
    version="2.0.0",
)

# Allow only the specified frontend origins to consume the API.
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
    """
    FastAPI dependency that opens a DB session for the duration of a request
    and guarantees it is closed afterward — even if an exception occurs.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pydantic response schemas
# ---------------------------------------------------------------------------
class RaceResponse(BaseModel):
    """Shape of a single race object returned by the API."""

    id: int
    year: int
    grand_prix: str
    session: str

    # Allow Pydantic to read attributes from SQLAlchemy ORM objects directly.
    model_config = {"from_attributes": True}


class TelemetryResponse(BaseModel):
    """Shape of a single telemetry data point returned by the API."""

    id: int
    race_id: int
    driver_id: int
    time: float          # milliseconds from lap start
    speed: int           # km/h
    gear: int
    x_coordinate: float  # circuit X position
    y_coordinate: float  # circuit Y position

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get(
    "/api/races",
    response_model=List[RaceResponse],
    summary="List all available races",
    response_description="All races currently stored in the database",
)
def list_races(db: Session = Depends(get_db)) -> List[models.Race]:
    """Return every race row from the Races table."""
    races = db.query(models.Race).all()
    if not races:
        raise HTTPException(
            status_code=404,
            detail="No races found. Run populate_db.py to seed the database.",
        )
    return races


@app.get(
    "/api/telemetry/{race_id}/{driver_id}",
    response_model=List[TelemetryResponse],
    summary="Telemetry for a specific race and driver",
    response_description=(
        "Time-ordered telemetry data points for the given race and driver"
    ),
)
def get_telemetry(
    race_id: int,
    driver_id: int,
    db: Session = Depends(get_db),
) -> List[models.Telemetry]:
    """
    Query the Telemetry table filtered by race_id and driver_id,
    ordered by the time column ascending.
    """
    # Validate that the referenced race actually exists.
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if race is None:
        raise HTTPException(
            status_code=404,
            detail=f"Race with id={race_id} not found.",
        )

    # Validate that the referenced driver actually exists.
    driver = (
        db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    )
    if driver is None:
        raise HTTPException(
            status_code=404,
            detail=f"Driver with id={driver_id} not found.",
        )

    telemetry = (
        db.query(models.Telemetry)
        .filter(
            models.Telemetry.race_id == race_id,
            models.Telemetry.driver_id == driver_id,
        )
        .order_by(models.Telemetry.time)
        .all()
    )

    if not telemetry:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No telemetry found for race_id={race_id} and"
                f" driver_id={driver_id}."
            ),
        )

    return telemetry


# To run the server locally:
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
