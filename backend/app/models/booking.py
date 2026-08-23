from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin
from app.models.types import UTCDateTime

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.item import Item


class BookingStatus(StrEnum):
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    CANCELLED = "cancelled"


class Booking(IdMixin, TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="ck_bookings_valid_interval"),
        CheckConstraint(
            "status IN ('confirmed', 'tentative', 'cancelled')",
            name="booking_status",
        ),
    )

    item_id: Mapped[str] = mapped_column(ForeignKey("items.id", ondelete="RESTRICT"), index=True)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    start_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    end_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
            native_enum=False,
            create_constraint=False,
            validate_strings=True,
            name="booking_status",
        ),
        default=BookingStatus.CONFIRMED,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    item: Mapped[Item] = relationship(back_populates="bookings")
    client: Mapped[Client] = relationship(back_populates="bookings")


@event.listens_for(Booking, "before_insert")
@event.listens_for(Booking, "before_update")
def validate_booking_interval(_mapper: object, _connection: object, booking: Booking) -> None:
    if booking.end_at <= booking.start_at:
        raise ValueError("end_at must be later than start_at")
