from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, BookingParticipant, RoleDefinition


def find_booking_overlap(
    session: Session,
    *,
    entity_id: str,
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: str | None = None,
) -> Booking | None:
    """Return the first overlap for an Entity configured as exclusive."""
    statement = (
        select(Booking)
        .join(BookingParticipant)
        .join(RoleDefinition)
        .where(
            BookingParticipant.entity_id == entity_id,
            RoleDefinition.is_exclusive.is_(True),
            Booking.start_at < end_at,
            Booking.end_at > start_at,
            Booking.status != "cancelled",
        )
    )
    if exclude_booking_id is not None:
        statement = statement.where(Booking.id != exclude_booking_id)

    return session.scalar(statement.limit(1))
