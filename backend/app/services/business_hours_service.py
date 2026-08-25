from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BusinessHours
from app.services.booking_service import BookingValidationError

if TYPE_CHECKING:
    pass


def get_business_hours(session: Session) -> dict[int, BusinessHours]:
    """Return all business hours indexed by day of week."""
    rows = session.scalars(select(BusinessHours)).all()
    return {row.day_of_week: row for row in rows}


def _to_time(value: str) -> time:
    hour, minute = value.split(":")
    return time(int(hour), int(minute))


def _to_str(value: time) -> str:
    return value.strftime("%H:%M")


def set_business_hours(
    session: Session, hours_payload: list[dict]
) -> dict[int, BusinessHours]:
    """Replace the full business-hours configuration."""
    existing = get_business_hours(session)
    seen_days: set[int] = set()
    for item in hours_payload:
        day = item["day_of_week"]
        if day in seen_days:
            raise ValueError(f"duplicate day_of_week: {day}")
        seen_days.add(day)
        row = existing.get(day)
        if row is None:
            row = BusinessHours(
                day_of_week=day,
                start_time=_to_time(item["start_time"]),
                end_time=_to_time(item["end_time"]),
                is_closed=item["is_closed"],
            )
            session.add(row)
        else:
            row.start_time = _to_time(item["start_time"])
            row.end_time = _to_time(item["end_time"])
            row.is_closed = item["is_closed"]
    session.commit()
    return get_business_hours(session)


def serialize_business_hours(hours: BusinessHours) -> dict:
    return {
        "id": hours.id,
        "day_of_week": hours.day_of_week,
        "start_time": _to_str(hours.start_time),
        "end_time": _to_str(hours.end_time),
        "is_closed": hours.is_closed,
        "created_at": hours.created_at,
        "updated_at": hours.updated_at,
    }


def validate_within_business_hours(
    session: Session,
    start_at: datetime,
    end_at: datetime,
) -> None:
    """Raise BookingValidationError if the interval falls outside configured business hours."""
    if start_at.tzinfo is None or end_at.tzinfo is None:
        raise BookingValidationError("start_at and end_at must include a timezone")

    hours_by_day = get_business_hours(session)
    if not hours_by_day:
        return

    local_tz = start_at.tzinfo
    local_start = start_at
    local_end = end_at
    if local_end < local_start:
        local_start, local_end = local_end, local_start

    current = date(local_start.year, local_start.month, local_start.day)
    end_date = date(local_end.year, local_end.month, local_end.day)
    one_day = timedelta(days=1)

    while current <= end_date:
        day_hours = hours_by_day.get(current.weekday())
        if day_hours is None or day_hours.is_closed:
            raise BookingValidationError(f"business is closed on {current.isoformat()}")

        day_start_local = datetime.combine(current, day_hours.start_time).replace(tzinfo=local_tz)
        day_end_local = datetime.combine(current, day_hours.end_time).replace(tzinfo=local_tz)

        interval_start = max(local_start, day_start_local)
        interval_end = min(local_end, day_end_local)
        if interval_start >= interval_end:
            raise BookingValidationError(
                f"booking must fall within business hours {_to_str(day_hours.start_time)}-"
                f"{_to_str(day_hours.end_time)} on {current.isoformat()}"
            )

        current += one_day


def get_min_max_time(hours_by_day: dict[int, BusinessHours]) -> tuple[str, str]:
    """Return the earliest start and latest end across open days."""
    open_hours = [h for h in hours_by_day.values() if not h.is_closed]
    if not open_hours:
        return ("00:00", "23:59")
    earliest = min(h.start_time for h in open_hours)
    latest = max(h.end_time for h in open_hours)
    return (_to_str(earliest), _to_str(latest))
