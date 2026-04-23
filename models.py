from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class Race(Base):
    __tablename__ = "races"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    grand_prix = Column(String, nullable=False)
    session = Column(String, nullable=False)
    race_date = Column(DateTime, nullable=True)

    # Relationship: one Race has many Telemetry rows
    telemetry = relationship("Telemetry", back_populates="race")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String(3), nullable=False, unique=True)
    name = Column(String, nullable=False)
    team = Column(String, nullable=False)

    # Relationship: one Driver has many Telemetry rows
    telemetry = relationship("Telemetry", back_populates="driver")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    race_id = Column(Integer, ForeignKey("races.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    lap_number = Column(Integer, nullable=False, default=0)
    is_fastest_lap = Column(Boolean, nullable=False, default=False)
    session_time = Column(Float, nullable=False)
    total_distance = Column(Float, nullable=False)
    time = Column(Float, nullable=False)
    speed = Column(Integer, nullable=False)
    gear = Column(Integer, nullable=False)
    x_coordinate = Column(Float, nullable=False)
    y_coordinate = Column(Float, nullable=False)

    # Relationships
    race = relationship("Race", back_populates="telemetry")
    driver = relationship("Driver", back_populates="telemetry")
