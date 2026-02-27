"""
populate_db.py — ETL pipeline for F1 telemetry data.

Flow:
  1. Load a fastf1 session (2023 Silverstone, Race).
  2. Upsert a Race row.
  3. Upsert a Driver row (VER / Max Verstappen).
  4. Insert Telemetry rows for VER's fastest lap.
"""

import fastf1
from pathlib import Path

from database import SessionLocal
from models import Driver, Race, Telemetry

# ---------------------------------------------------------------------------
# fastf1 cache — reuse the same cache directory as main.py
# ---------------------------------------------------------------------------
CACHE_DIR = Path(__file__).parent / "f1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

# ---------------------------------------------------------------------------
# Session constants
# ---------------------------------------------------------------------------
YEAR = 2023
GRAND_PRIX = "Silverstone"
SESSION_TYPE = "R"

DRIVER_ABBR = "VER"
DRIVER_NAME = "Max Verstappen"
DRIVER_TEAM = "Red Bull Racing"


def run_etl() -> None:
    # ------------------------------------------------------------------
    # 1. Fetch data from fastf1
    # ------------------------------------------------------------------
    print(f"[fastf1] Loading {YEAR} {GRAND_PRIX} – {SESSION_TYPE} session…")
    f1_session = fastf1.get_session(YEAR, GRAND_PRIX, SESSION_TYPE)
    f1_session.load(telemetry=True, laps=True, weather=False, messages=False)
    print("[fastf1] Session loaded successfully.")

    # Retrieve the fastest lap for VER and its car telemetry
    ver_laps = f1_session.laps.pick_driver(DRIVER_ABBR)
    fastest_lap = ver_laps.pick_fastest()
    if fastest_lap is None or fastest_lap.empty:
        raise RuntimeError(f"No fastest lap found for driver {DRIVER_ABBR}.")

    # X/Y coordinates come from position data, NOT car data.
    # We merge both streams on the Time axis so every row has Speed, Gear, X, Y.
    car_data = fastest_lap.get_car_data()          # Speed, nGear, Brake, …
    pos_data = fastest_lap.get_pos_data()          # X, Y, Z
    telemetry_df = car_data.merge_channels(pos_data)  # aligns on Time

    # Keep only the columns we need and drop rows with missing values
    telemetry_df = telemetry_df[["Time", "Speed", "nGear", "X", "Y"]].dropna()

    # Convert Timedelta → float (milliseconds) so SQLAlchemy can store it
    telemetry_df["Time"] = (
        telemetry_df["Time"].dt.total_seconds() * 1000
    ).astype(float)

    telemetry_df["nGear"] = telemetry_df["nGear"].astype(int)
    telemetry_df["Speed"] = telemetry_df["Speed"].astype(int)

    print(
        f"[fastf1] Telemetry extracted — {len(telemetry_df)} data points for"
        f" {DRIVER_ABBR}'s fastest lap."
    )

    # ------------------------------------------------------------------
    # 2. Persist to the database
    # ------------------------------------------------------------------
    session = SessionLocal()
    try:
        # --- Race -------------------------------------------------------
        print(
            f"[DB] Checking if Race ({YEAR} {GRAND_PRIX} – {SESSION_TYPE})"
            " exists…"
        )
        race = (
            session.query(Race)
            .filter_by(year=YEAR, grand_prix=GRAND_PRIX, session=SESSION_TYPE)
            .first()
        )
        if race is None:
            race = Race(year=YEAR, grand_prix=GRAND_PRIX, session=SESSION_TYPE)
            session.add(race)
            session.flush()  # Populate race.id without a full commit
            print(f"[DB] Race inserted with id={race.id}.")
        else:
            print(f"[DB] Race already exists (id={race.id}). Skipping insert.")

        # --- Driver -----------------------------------------------------
        print(f"[DB] Checking if Driver ({DRIVER_ABBR}) exists…")
        driver = (
            session.query(Driver)
            .filter_by(abbreviation=DRIVER_ABBR)
            .first()
        )
        if driver is None:
            driver = Driver(
                abbreviation=DRIVER_ABBR,
                name=DRIVER_NAME,
                team=DRIVER_TEAM,
            )
            session.add(driver)
            session.flush()  # Populate driver.id without a full commit
            print(f"[DB] Driver inserted with id={driver.id}.")
        else:
            print(
                f"[DB] Driver already exists (id={driver.id}). Skipping insert."
            )

        # --- Telemetry --------------------------------------------------
        print(
            f"[DB] Inserting {len(telemetry_df)} telemetry rows"
            f" (race_id={race.id}, driver_id={driver.id})…"
        )

        # Build ORM objects in bulk for efficiency
        # Cast NumPy scalars → native Python types.
        # psycopg2 cannot serialise np.float64/np.int64 directly and mistakenly
        # treats them as schema-qualified identifiers (e.g. "np.float64(...)").
        telemetry_objects = [
            Telemetry(
                race_id=race.id,
                driver_id=driver.id,
                time=float(row["Time"]),
                speed=int(row["Speed"]),
                gear=int(row["nGear"]),
                x_coordinate=float(row["X"]),
                y_coordinate=float(row["Y"]),
            )
            for _, row in telemetry_df.iterrows()
        ]

        # bulk_save_objects bypasses individual INSERT round-trips
        session.bulk_save_objects(telemetry_objects)

        # Commit everything (Race, Driver, Telemetry) atomically
        session.commit()
        print("[DB] ✅ All data committed successfully.")

    except Exception as exc:
        # Roll back the entire transaction on any error to keep DB consistent
        session.rollback()
        print(f"[DB] ❌ Error occurred — transaction rolled back.\nDetails: {exc}")
        raise

    finally:
        # Always release the connection back to the pool
        session.close()
        print("[DB] Session closed.")


if __name__ == "__main__":
    run_etl()
