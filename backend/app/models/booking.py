from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Text, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin
from app.models.types import UTCDateTime

if TYPE_CHECKING:
    from app.models.booking_type import BookingType
    from app.models.entity import Entity, RoleDefinition


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
    booking_type_id: Mapped[str | None] = mapped_column(
        ForeignKey("booking_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    booking_type: Mapped[BookingType | None] = relationship(back_populates="bookings")
    participants: Mapped[list[BookingParticipant]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingParticipant.display_order",
    )


class BookingParticipant(IdMixin, TimestampMixin, Base):
    __tablename__ = "booking_participants"
    __table_args__ = (
        UniqueConstraint(
            "booking_id",
            "entity_id",
            "role_definition_id",
            name="uq_booking_participant",
        ),
    )

    booking_id: Mapped[str] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"),
        index=True,
    )
    entity_id: Mapped[str] = mapped_column(
        ForeignKey("entities.id", ondelete="RESTRICT"),
        index=True,
    )
    role_definition_id: Mapped[str] = mapped_column(
        ForeignKey("role_definitions.id", ondelete="RESTRICT"),
        index=True,
    )
    display_order: Mapped[int] = mapped_column(default=0)

    booking: Mapped[Booking] = relationship(back_populates="participants")
    entity: Mapped[Entity] = relationship(back_populates="booking_participants")
    role_definition: Mapped[RoleDefinition] = relationship(back_populates="booking_participants")


@event.listens_for(Booking, "before_insert")
@event.listens_for(Booking, "before_update")
def validate_booking_interval(_mapper: object, _connection: object, booking: Booking) -> None:
    if booking.end_at <= booking.start_at:
        raise ValueError("end_at must be later than start_at")
