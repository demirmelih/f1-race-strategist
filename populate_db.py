"""
populate_db.py — ETL pipeline for F1 telemetry data (ALL drivers).

Time-Based & Distance-Sorted engine.

Flow:
  1. Load the 2023 Silverstone Race session via fastf1.
  2. Upsert a Race row (with race_date).
  3. Discover and upsert ALL drivers that participated.
  4. For each driver:
     a) Full Race telemetry: resample to 1-second intervals using SessionTime.
        Store Distance as total_distance, SessionTime (seconds) as session_time.
        → is_fastest_lap=False.
     b) Fastest Lap telemetry (Ghost Race): normalize time & distance to
        start at zero.  Resample to 200ms intervals for smooth animation.
        → is_fastest_lap=True.
  5. Bulk-insert everything via bulk_insert_mappings for speed.
"""

import argparse
import fastf1
import traceback
import numpy as np
import pandas as pd
from pathlib import Path

from database import SessionLocal, engine
from models import Driver, Race, Telemetry
import sqlalchemy as sa

# ---------------------------------------------------------------------------
# fastf1 cache
# ---------------------------------------------------------------------------
CACHE_DIR = Path(__file__).parent / "f1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

# Resample intervals
FULL_RACE_INTERVAL = "1s"       # 1 point per second for full race
FASTEST_LAP_INTERVAL = "200ms"  # 5 points per second for ghost race


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resample_telemetry(
    df: pd.DataFrame,
    interval: str,
    time_col: str = "SessionTime",
) -> pd.DataFrame:
    """
    Resample telemetry to the given interval using `time_col` as the time axis.

    Returns a DataFrame with columns:
      session_time (float, seconds), total_distance, Speed, nGear, X, Y
    """
    df = df.copy()

    # Convert timedelta to a fake datetime so pandas .resample() works
    origin = pd.Timestamp("2000-01-01")
    df["_ts"] = origin + pd.to_timedelta(df[time_col])
    df = df.set_index("_ts")

    numeric_cols = ["Speed", "nGear", "X", "Y", "Distance"]
    # Keep only columns that exist
    numeric_cols = [c for c in numeric_cols if c in df.columns]

    resampled = df[numeric_cols].resample(interval).mean().dropna()

    # Recover session_time as float seconds from the fake datetime index
    resampled["session_time"] = (resampled.index - origin).total_seconds()

    # Rename Distance → total_distance
    if "Distance" in resampled.columns:
        resampled = resampled.rename(columns={"Distance": "total_distance"})
    else:
        resampled["total_distance"] = 0.0

    # Also keep a "time" column (milliseconds) for backward compat
    resampled["time"] = resampled["session_time"] * 1000

    resampled = resampled.reset_index(drop=True)
    return resampled


def _extract_lap_telemetry(lap) -> pd.DataFrame | None:
    """Return a telemetry dataframe for a single lap using get_telemetry(), or None on failure."""
    try:
        tel = lap.get_telemetry()
        if tel is None or tel.empty:
            return None
        # get_telemetry() returns: Time, SessionTime, Speed, nGear, X, Y, Distance (and more)
        required = ["Time", "Speed", "nGear", "X", "Y"]
        if not all(c in tel.columns for c in required):
            print(f"    ⚠ Missing columns. Got: {list(tel.columns)}")
            return None
        # Keep only columns we need; Distance and SessionTime are optional but important
        keep = [c for c in ["Time", "SessionTime", "Speed", "nGear", "X", "Y", "Distance"] if c in tel.columns]
        tel = tel[keep].dropna(subset=["Time", "Speed", "nGear", "X", "Y"])
        if tel.empty:
            return None
        return tel
    except Exception as e:
        print(f"    ⚠ get_telemetry() error: {e}")
        traceback.print_exc()
        return None


def run_etl(
    year: int = 2023,
    grand_prix: str = "Silverstone",
    session_type: str = "R",
) -> None:
    # ------------------------------------------------------------------
    # 1. Load fastf1 session
    # ------------------------------------------------------------------
    print(f"[fastf1] Loading {year} {grand_prix} – {session_type}…")
    f1_session = fastf1.get_session(year, grand_prix, session_type)
    f1_session.load(telemetry=True, laps=True, weather=False, messages=False)
    print("[fastf1] Session loaded.")

    all_laps = f1_session.laps

    # ------------------------------------------------------------------
    # 1b. Extract race date
    # ------------------------------------------------------------------
    race_date = None
    try:
        # Try event date first
        race_date = pd.Timestamp(f1_session.event.EventDate).to_pydatetime()
    except Exception:
        pass
    if race_date is None:
        try:
            race_date = pd.Timestamp(f1_session.date).to_pydatetime()
        except Exception:
            pass
    print(f"[fastf1] Race date: {race_date}")

    # ------------------------------------------------------------------
    # 2. Discover all drivers
    # ------------------------------------------------------------------
    driver_info: dict[str, dict] = {}
    for _, lap in all_laps.iterrows():
        abbr = str(lap["Driver"])
        if abbr not in driver_info:
            try:
                full_name = str(lap["DriverFullName"] if "DriverFullName" in lap.index else abbr)
            except Exception:
                full_name = abbr
            try:
                team = str(lap["Team"])
            except Exception:
                team = "Unknown"
            driver_info[abbr] = {"name": full_name, "team": team}

    print(f"[fastf1] Discovered {len(driver_info)} drivers: {', '.join(sorted(driver_info))}")

    # ------------------------------------------------------------------
    # 3. Persist to DB
    # ------------------------------------------------------------------
    session = SessionLocal()
    try:
        # --- Race ---
        race = (
            session.query(Race)
            .filter_by(year=year, grand_prix=grand_prix, session=session_type)
            .first()
        )
        if race is None:
            race = Race(
                year=year,
                grand_prix=grand_prix,
                session=session_type,
                race_date=race_date,
            )
            session.add(race)
            session.flush()
            print(f"[DB] Race inserted (id={race.id}).")
        else:
            race.race_date = race_date
            session.flush()
            print(f"[DB] Race exists (id={race.id}), updated race_date.")

        # --- Delete old telemetry for this race (idempotent re-runs) ---
        deleted = (
            session.query(Telemetry)
            .filter(Telemetry.race_id == race.id)
            .delete()
        )
        print(f"[DB] Cleared {deleted} old telemetry rows for race_id={race.id}.")

        # --- Drivers ---
        abbr_to_id: dict[str, int] = {}
        for abbr, info in driver_info.items():
            driver = session.query(Driver).filter_by(abbreviation=abbr).first()
            if driver is None:
                driver = Driver(abbreviation=abbr, name=info["name"], team=info["team"])
                session.add(driver)
                session.flush()
                print(f"[DB] Driver {abbr} inserted (id={driver.id}).")
            else:
                # Update team/name in case they changed
                driver.name = info["name"]
                driver.team = info["team"]
                session.flush()
            abbr_to_id[abbr] = driver.id

        # Commit Race + Driver changes so the raw psycopg2 connection
        # used for telemetry inserts can see them (FK constraint).
        session.commit()
        print("[DB] Race and drivers committed.")

        # --- Telemetry ---
        all_rows: list[dict] = []
        fastest_count = 0
        fullrace_count = 0

        for abbr in sorted(driver_info):
            driver_id = abbr_to_id[abbr]
            driver_laps = all_laps.pick_drivers(abbr)

            # ── A) Fastest lap (Ghost Race) ─────────────────────
            try:
                fastest = driver_laps.pick_fastest()
                if fastest is not None and not fastest.empty:
                    fl_number = int(fastest["LapNumber"]) if "LapNumber" in fastest.index else 0
                    tel = _extract_lap_telemetry(fastest)
                    if tel is not None and not tel.empty:
                        # Normalize: time and distance start at zero
                        if "Time" in tel.columns:
                            time_zero = tel["Time"].iloc[0]
                            tel["Time"] = tel["Time"] - time_zero
                        if "Distance" in tel.columns:
                            dist_zero = tel["Distance"].iloc[0]
                            tel["Distance"] = tel["Distance"] - dist_zero

                        # Use "Time" (lap-relative) as the resample axis
                        resampled = _resample_telemetry(tel, FASTEST_LAP_INTERVAL, time_col="Time")

                        # Overwrite session_time with the normalized time
                        # (since we zeroed Time, session_time from _resample is already zero-based)

                        for _, r in resampled.iterrows():
                            all_rows.append({
                                "race_id": race.id,
                                "driver_id": driver_id,
                                "lap_number": int(fl_number),
                                "is_fastest_lap": True,
                                "session_time": float(r["session_time"]),
                                "total_distance": float(r["total_distance"]),
                                "time": float(r["time"]),
                                "speed": int(round(r["Speed"])),
                                "gear": int(round(r["nGear"])),
                                "x_coordinate": float(r["X"]),
                                "y_coordinate": float(r["Y"]),
                            })
                        fastest_count += len(resampled)
                        print(f"  [{abbr}] Fastest lap #{fl_number}: {len(resampled)} pts (200ms)")
            except Exception as e:
                print(f"  [{abbr}] WARNING Fastest lap failed: {e}")

            # ── B) Full race (per-lap resampling, correct lap_number stamped) ──
            # Processing per lap instead of concatenated keeps lap_number accurate.
            # session_time values are still absolute (SessionTime) so animation is continuous.
            try:
                lap_point_count = 0
                for _, lap in driver_laps.iterrows():
                    lap_num = int(lap["LapNumber"]) if "LapNumber" in lap.index else 0
                    tel = _extract_lap_telemetry(lap)
                    if tel is None or tel.empty or "SessionTime" not in tel.columns:
                        continue
                    resampled = _resample_telemetry(tel, FULL_RACE_INTERVAL, time_col="SessionTime")
                    for _, r in resampled.iterrows():
                        all_rows.append({
                            "race_id": race.id,
                            "driver_id": driver_id,
                            "lap_number": lap_num,
                            "is_fastest_lap": False,
                            "session_time": float(r["session_time"]),
                            "total_distance": float(r["total_distance"]),
                            "time": float(r["time"]),
                            "speed": int(round(r["Speed"])),
                            "gear": int(round(r["nGear"])),
                            "x_coordinate": float(r["X"]),
                            "y_coordinate": float(r["Y"]),
                        })
                        fullrace_count += 1
                        lap_point_count += 1
                if lap_point_count > 0:
                    print(f"  [{abbr}] Full race: {lap_point_count} pts (1s)")
                else:
                    print(f"  [{abbr}] WARNING Full race: no telemetry data (DNF?)")
            except Exception as e:
                print(f"  [{abbr}] WARNING Full race failed: {e}")

        # ── Insert using psycopg2 execute_values for Supabase compatibility ──
        from psycopg2.extras import execute_values

        total = len(all_rows)
        print(f"\n[DB] Inserting {total} rows "
              f"({fastest_count} fastest-lap + {fullrace_count} full-race)...")

        COLUMNS = [
            "race_id", "driver_id", "lap_number", "is_fastest_lap",
            "session_time", "total_distance", "time",
            "speed", "gear", "x_coordinate", "y_coordinate",
        ]
        insert_sql = (
            f"INSERT INTO telemetry ({', '.join(COLUMNS)}) "
            f"VALUES %s"
        )
        # Convert list-of-dicts to list-of-tuples
        tuples = [tuple(row[c] for c in COLUMNS) for row in all_rows]

        BATCH = 500
        raw_conn = engine.raw_connection()
        try:
            cur = raw_conn.cursor()
            for i in range(0, total, BATCH):
                chunk = tuples[i : i + BATCH]
                execute_values(cur, insert_sql, chunk, page_size=50)
                raw_conn.commit()
                if (i // BATCH) % 20 == 0:
                    print(f"  ... inserted {min(i + BATCH, total)} / {total} rows")
            cur.close()
        finally:
            raw_conn.close()

        session.commit()  # commit Race/Driver ORM changes
        print("[DB] All data committed successfully.")

    except Exception as exc:
        try:
            session.rollback()
        except Exception:
            pass
        print(f"[DB] ERROR - rolled back. Details: {exc}")
        import traceback as tb
        tb.print_exc()
        raise
    finally:
        session.close()
        print("[DB] Session closed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="F1 ETL pipeline — fetch telemetry from FastF1 and populate PostgreSQL"
    )
    parser.add_argument("--year", type=int, default=2023, help="Season year (e.g. 2023)")
    parser.add_argument("--gp", type=str, default="Silverstone", help="Grand Prix name (e.g. Monaco)")
    parser.add_argument(
        "--session", type=str, default="R",
        help="Session type: R=Race, Q=Qualifying, FP1/FP2/FP3=Practice"
    )
    args = parser.parse_args()
    run_etl(year=args.year, grand_prix=args.gp, session_type=args.session)
