from __future__ import annotations

from datetime import time

from sqlalchemy import Boolean, CheckConstraint, Integer, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin


class BusinessHours(IdMixin, TimestampMixin, Base):
    """Configured opening hours per day of the week (0=Monday, 6=Sunday)."""

    __tablename__ = "business_hours"
    __table_args__ = (
        UniqueConstraint("day_of_week", name="uq_business_hours_day"),
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_business_hours_day_range"),
        CheckConstraint(
            "is_closed OR end_time > start_time",
            name="ck_business_hours_valid_interval",
        ),
    )

    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
