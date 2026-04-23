"""
reset_db.py — Drop and recreate the races and telemetry tables.

Run this after changing the Race or Telemetry model columns,
then re-run populate_db.py.  The drivers table is left untouched.
"""

from database import engine, Base
import models  # noqa: F401 – registers ORM models with Base.metadata


def reset_tables() -> None:
    races_table = models.Race.__table__
    telemetry_table = models.Telemetry.__table__

    # Drop telemetry first (it has a FK to races)
    print("[reset] Dropping 'telemetry' table…")
    telemetry_table.drop(engine, checkfirst=True)

    print("[reset] Dropping 'races' table…")
    races_table.drop(engine, checkfirst=True)

    print("[reset] Recreating 'races' table with updated schema…")
    races_table.create(engine, checkfirst=True)

    print("[reset] Recreating 'telemetry' table with updated schema…")
    telemetry_table.create(engine, checkfirst=True)

    # Reset sequences so IDs start from 1 again.
    # Supabase (PostgreSQL) sequences are independent objects and can survive table
    # drops in some configurations — explicitly restarting them avoids stale IDs.
    import sqlalchemy as sa
    with engine.connect() as conn:
        for seq in ("races_id_seq", "telemetry_id_seq"):
            try:
                conn.execute(sa.text(f"ALTER SEQUENCE {seq} RESTART WITH 1"))
                conn.commit()
                print(f"[reset] Sequence '{seq}' reset to 1.")
            except Exception:
                pass  # sequence may not exist if table used IDENTITY column

    print("[reset] ✅ Done. Run populate_db.py to re-seed data.")


if __name__ == "__main__":
    reset_tables()
