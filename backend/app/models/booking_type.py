from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.booking import Booking


class DurationMode(StrEnum):
    SUGGESTED = "suggested"
    FIXED = "fixed"


class BookingType(IdMixin, TimestampMixin, Base):
    __tablename__ = "booking_types"
    __table_args__ = (
        UniqueConstraint("booking_scope", "key", name="uq_booking_types_scope_key"),
        CheckConstraint(
            "default_duration_minutes IS NULL OR default_duration_minutes > 0",
            name="ck_booking_types_positive_duration",
        ),
        CheckConstraint(
            "duration_mode IN ('suggested', 'fixed')",
            name="duration_mode",
        ),
    )

    key: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(120))
    booking_scope: Mapped[str] = mapped_column(String(80), default="default", index=True)
    default_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_mode: Mapped[DurationMode] = mapped_column(
        Enum(
            DurationMode,
            values_callable=lambda modes: [mode.value for mode in modes],
            native_enum=False,
            create_constraint=False,
            validate_strings=True,
            name="duration_mode",
        ),
        default=DurationMode.SUGGESTED,
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    bookings: Mapped[list[Booking]] = relationship(back_populates="booking_type")
