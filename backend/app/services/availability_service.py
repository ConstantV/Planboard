from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    BookingParticipant,
    BookingStatus,
    BusinessHours,
    Entity,
    RoleDefinition,
)
from app.services.booking_service import (
    BookingValidationError,
    find_booking_overlap,
    serialize_booking,
)
from app.services.business_hours_service import get_business_hours
from app.services.management_service import category_descendant_ids


def validate_interval(start_at: datetime, end_at: datetime) -> None:
    if any(value.tzinfo is None or value.utcoffset() is None for value in (start_at, end_at)):
        raise BookingValidationError("start_at and end_at must include a timezone")
    if end_at <= start_at:
        raise BookingValidationError("end_at must be later than start_at")


def find_available_entities(
    session: Session,
    *,
    start_at: datetime,
    end_at: datetime,
    role_definition_id: str | None = None,
    entity_type_id: str | None = None,
    category_id: str | None = None,
    filters: dict[str, Any] | None = None,
    exclude_booking_id: str | None = None,
) -> list[Entity]:
    """Return active exclusive entities that are free for the entire interval.

    If ``role_definition_id`` is provided, only entities matching that role's
    EntityType are considered. Otherwise every active entity with at least one
    active exclusive role is eligible. Custom field filters require an
    ``entity_type_id`` and reuse the same filterable-field rules as the entity
    list.
    """
    validate_interval(start_at, end_at)

    statement = select(Entity).where(Entity.is_active.is_(True))

    if role_definition_id is not None:
        role = session.get(RoleDefinition, role_definition_id)
        if role is None or not role.is_active or not role.is_exclusive:
            return []
        statement = statement.where(Entity.entity_type_id == role.entity_type_id)
    else:
        exclusive_role_query = select(RoleDefinition.entity_type_id).where(
            RoleDefinition.is_active.is_(True),
            RoleDefinition.is_exclusive.is_(True),
        )
        statement = statement.where(Entity.entity_type_id.in_(exclusive_role_query))

    if entity_type_id is not None:
        statement = statement.where(Entity.entity_type_id == entity_type_id)

    if category_id is not None:
        statement = statement.where(Entity.category_id.in_(category_descendant_ids(category_id)))

    if filters:
        if entity_type_id is None and role_definition_id is None:
            raise BookingValidationError(
                "custom field filters require entity_type_id or role_definition_id"
            )
        target_type_id = entity_type_id or session.get(
            RoleDefinition, role_definition_id
        ).entity_type_id
        statement = _apply_field_filters(session, statement, target_type_id, filters)

    entities = list(session.scalars(statement.order_by(Entity.name)).unique())
    return [
        entity
        for entity in entities
        if find_booking_overlap(
            session,
            entity_id=entity.id,
            start_at=start_at,
            end_at=end_at,
            exclude_booking_id=exclude_booking_id,
        )
        is None
    ]


def _apply_field_filters(
    session: Session,
    statement: Any,
    entity_type_id: str,
    field_filters: dict[str, Any],
) -> Any:
    from app.models import EntityFieldValue, FieldDefinition
    from app.services.entity_service import (
        EntityConfigurationError,
        build_field_value,
        field_value_column,
    )

    definitions = {
        definition.key: definition
        for definition in session.scalars(
            select(FieldDefinition).where(
                FieldDefinition.entity_type_id == entity_type_id,
                FieldDefinition.is_active.is_(True),
            )
        )
    }
    for key, raw_value in field_filters.items():
        definition = definitions.get(key)
        if definition is None or not definition.is_filterable:
            raise EntityConfigurationError(f"field is not filterable: {key}")
        typed_value = build_field_value(definition, raw_value)
        value_column = field_value_column(definition.data_type)
        statement = statement.where(
            Entity.field_values.any(
                (EntityFieldValue.field_definition_id == definition.id)
                & (value_column == getattr(typed_value, value_column.key))
            )
        )
    return statement


def occupancy_for_entity(
    session: Session,
    *,
    entity_id: str,
    range_start: datetime,
    range_end: datetime,
) -> dict[str, Any]:
    """Return bookings and free gaps for an entity within a range.

    Free gaps are clipped to configured business hours and exclude closed days.
    Cancelled bookings are omitted from occupancy and treated as free time.
    """
    validate_interval(range_start, range_end)

    entity = session.get(Entity, entity_id)
    if entity is None:
        raise BookingValidationError(f"Entity does not exist: {entity_id}")

    bookings_statement = (
        select(Booking)
        .join(BookingParticipant)
        .where(
            BookingParticipant.entity_id == entity_id,
            Booking.start_at < range_end,
            Booking.end_at > range_start,
            Booking.status != BookingStatus.CANCELLED,
        )
        .order_by(Booking.start_at, Booking.id)
    )
    bookings = list(session.scalars(bookings_statement).unique())

    hours_by_day = get_business_hours(session)
    free_gaps = _compute_free_gaps(range_start, range_end, bookings, hours_by_day)

    return {
        "entity_id": entity_id,
        "range_start": range_start,
        "range_end": range_end,
        "bookings": [serialize_booking(booking) for booking in bookings],
        "free_gaps": free_gaps,
    }


def _compute_free_gaps(
    range_start: datetime,
    range_end: datetime,
    bookings: list[Booking],
    hours_by_day: dict[int, BusinessHours],
) -> list[dict[str, str]]:
    if not hours_by_day:
        return []

    local_tz = range_start.tzinfo
    current_date = date(range_start.year, range_start.month, range_start.day)
    end_date = date(range_end.year, range_end.month, range_end.day)
    one_day = timedelta(days=1)

    free_gaps: list[dict[str, str]] = []

    while current_date <= end_date:
        day_hours = hours_by_day.get(current_date.weekday())
        if day_hours is None or day_hours.is_closed:
            current_date += one_day
            continue

        day_open = datetime.combine(current_date, day_hours.start_time).replace(tzinfo=local_tz)
        day_close = datetime.combine(current_date, day_hours.end_time).replace(tzinfo=local_tz)

        window_start = max(day_open, range_start)
        window_end = min(day_close, range_end)
        if window_start >= window_end:
            current_date += one_day
            continue

        day_bookings = [
            booking
            for booking in bookings
            if booking.end_at > window_start and booking.start_at < window_end
        ]
        cursor = window_start
        for booking in sorted(day_bookings, key=lambda b: b.start_at):
            if booking.start_at > cursor:
                free_gaps.append(_gap(cursor, min(booking.start_at, window_end)))
            cursor = max(cursor, booking.end_at)
            if cursor >= window_end:
                break
        if cursor < window_end:
            free_gaps.append(_gap(cursor, window_end))

        current_date += one_day

    return free_gaps


def _gap(start: datetime, end: datetime) -> dict[str, str]:
    return {"start_at": start.isoformat(), "end_at": end.isoformat()}
