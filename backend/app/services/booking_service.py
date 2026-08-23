from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking


def find_booking_overlap(
    session: Session,
    *,
    item_id: str,
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: str | None = None,
) -> Booking | None:
    """Return the first booking that overlaps the proposed interval."""
    statement = select(Booking).where(
        Booking.item_id == item_id,
        Booking.start_at < end_at,
        Booking.end_at > start_at,
        Booking.status != "cancelled",
    )
    if exclude_booking_id is not None:
        statement = statement.where(Booking.id != exclude_booking_id)

    return session.scalar(statement.limit(1))
