import fastf1
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

# ---------------------------------------------------------------------------
# Cache setup
# fastf1 caches downloaded session data locally to avoid redundant API calls.
# We point it to a dedicated folder in the project root.
# ---------------------------------------------------------------------------
CACHE_DIR = Path(__file__).parent / "f1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = FastAPI(
    title="F1 Race Strategist API",
    description="Serves F1 telemetry data powered by the fastf1 library.",
    version="1.0.0",
)

# Allow all origins so the frontend (any port / domain) can reach this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoint: fastest-lap telemetry
# ---------------------------------------------------------------------------
@app.get(
    "/api/race/{year}/{grand_prix}/{session}/fastest-lap",
    summary="Fastest-lap telemetry",
    response_description="Car telemetry for the fastest lap of the session",
)
async def get_fastest_lap_telemetry(year: int, grand_prix: str, session: str):
    """
    Returns telemetry data (Time, Speed, Gear, X, Y) for the driver who set
    the overall fastest lap in the given session.

    Path parameters
    ---------------
    year        : Season year, e.g. 2023
    grand_prix  : Event name or round number recognised by fastf1,
                  e.g. "Bahrain" or "Monaco"
    session     : Session identifier – "R" (Race), "Q" (Qualifying),
                  "FP1", "FP2", "FP3", "S" (Sprint), etc.
    """
    try:
        # Load the session. fastf1 fetches data from the Ergast / F1 APIs and
        # caches the result locally for subsequent requests.
        evt = fastf1.get_session(year, grand_prix, session)
        evt.load(telemetry=True, laps=True, weather=False, messages=False)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Could not load session '{session}' for {year} {grand_prix}: {exc}",
        )

    # Pick the single fastest lap across all drivers in the session.
    fastest_lap = evt.laps.pick_fastest()

    if fastest_lap is None or fastest_lap.empty:
        raise HTTPException(
            status_code=404,
            detail="No fastest lap found for this session.",
        )

    driver_code = fastest_lap["Driver"]
    lap_time = str(fastest_lap["LapTime"])  # timedelta → readable string

    try:
        # Retrieve the detailed car telemetry for that lap.
        # add_distance=True appends a running distance channel (optional but useful).
        telemetry: pd.DataFrame = fastest_lap.get_car_data().add_distance()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve telemetry: {exc}",
        )

    # ------------------------------------------------------------------
    # Column selection
    # We only expose the columns the frontend needs.  Rename them to more
    # readable keys while we're at it.
    # ------------------------------------------------------------------
    column_map = {
        "Time": "time_ms",   # timedelta – converted below
        "Speed": "speed_kmh",
        "nGear": "gear",
        "X": "x",
        "Y": "y",
    }

    # Keep only the columns that actually exist in this session's data.
    existing_cols = [c for c in column_map if c in telemetry.columns]
    telemetry = telemetry[existing_cols].rename(columns=column_map)

    # ------------------------------------------------------------------
    # Data cleaning
    # fastf1 can return NaN for missing samples.  Drop any row that has at
    # least one NaN so the JSON payload stays consistent and type-safe.
    # ------------------------------------------------------------------
    telemetry = telemetry.dropna()

    # The "Time" channel is a pandas Timedelta.  JSON can't serialise that
    # natively, so convert each value to total milliseconds (int).
    if "time_ms" in telemetry.columns:
        telemetry["time_ms"] = telemetry["time_ms"].dt.total_seconds() * 1000
        telemetry["time_ms"] = telemetry["time_ms"].astype(int)

    # Convert gear to plain int (it arrives as float64 after dropna).
    if "gear" in telemetry.columns:
        telemetry["gear"] = telemetry["gear"].astype(int)

    # ------------------------------------------------------------------
    # Serialisation
    # Convert the DataFrame to a list of dicts – the safest, most portable
    # JSON structure for a tabular dataset.
    # ------------------------------------------------------------------
    records = telemetry.to_dict(orient="records")

    return {
        "year": year,
        "grand_prix": grand_prix,
        "session": session,
        "driver": driver_code,
        "lap_time": lap_time,
        "telemetry": records,
    }


# To run the server locally:
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
