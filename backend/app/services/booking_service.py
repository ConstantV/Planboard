from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Booking,
    BookingParticipant,
    BookingStatus,
    Entity,
    EntityCategory,
    RoleDefinition,
)
from app.services.entity_service import contains_pattern, resolve_entity_color
from app.services.management_service import category_descendant_ids, list_entities


class BookingValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ParticipantSpec:
    entity: Entity
    role: RoleDefinition
    display_order: int


def begin_booking_write(session: Session) -> None:
    """Serialize SQLite booking writes; PostgreSQL uses participant row locks."""
    connection = session.connection()
    if connection.dialect.name == "sqlite":
        connection.exec_driver_sql("BEGIN IMMEDIATE")


def booking_statement() -> Select:
    return select(Booking).options(
        selectinload(Booking.participants).selectinload(BookingParticipant.role_definition),
        selectinload(Booking.participants)
        .selectinload(BookingParticipant.entity)
        .selectinload(Entity.entity_type),
        selectinload(Booking.participants)
        .selectinload(BookingParticipant.entity)
        .selectinload(Entity.category)
        .selectinload(EntityCategory.parent),
    )


def validate_interval(start_at: datetime, end_at: datetime) -> None:
    if any(value.tzinfo is None or value.utcoffset() is None for value in (start_at, end_at)):
        raise BookingValidationError("start_at and end_at must include a timezone")
    if end_at <= start_at:
        raise BookingValidationError("end_at must be later than start_at")


def resolve_participants(
    session: Session,
    participants: Iterable[Any],
) -> list[ParticipantSpec]:
    resolved: list[ParticipantSpec] = []
    seen: set[tuple[str, str]] = set()
    role_counts: dict[str, int] = {}
    booking_scope: str | None = None

    for participant in participants:
        entity = session.get(Entity, participant.entity_id)
        if entity is None:
            raise BookingValidationError(f"Entity does not exist: {participant.entity_id}")
        role = session.get(RoleDefinition, participant.role_definition_id)
        if role is None:
            raise BookingValidationError(
                f"RoleDefinition does not exist: {participant.role_definition_id}"
            )
        if not entity.is_active or not entity.entity_type.is_active:
            raise BookingValidationError(f"Entity is inactive: {entity.id}")
        if not role.is_active:
            raise BookingValidationError(f"RoleDefinition is inactive: {role.id}")
        if booking_scope is None:
            booking_scope = role.booking_scope
        elif role.booking_scope != booking_scope:
            raise BookingValidationError("all participant roles must use the same booking_scope")
        if entity.entity_type_id != role.entity_type_id:
            raise BookingValidationError(
                f"Entity {entity.id} does not match role {role.key} EntityType"
            )
        participant_key = (entity.id, role.id)
        if participant_key in seen:
            raise BookingValidationError(
                f"duplicate participant for Entity {entity.id} and role {role.key}"
            )
        seen.add(participant_key)
        role_counts[role.id] = role_counts.get(role.id, 0) + 1
        if role_counts[role.id] > 1 and not role.allow_multiple:
            raise BookingValidationError(f"role does not allow multiple participants: {role.key}")
        resolved.append(ParticipantSpec(entity, role, participant.display_order))

    if not resolved:
        raise BookingValidationError("at least one participant is required")

    required_roles = list(
        session.scalars(
            select(RoleDefinition).where(
                RoleDefinition.is_active.is_(True),
                RoleDefinition.is_required.is_(True),
                RoleDefinition.booking_scope == booking_scope,
            )
        )
    )
    missing_roles = [role.key for role in required_roles if role.id not in role_counts]
    if missing_roles:
        raise BookingValidationError(f"missing required roles: {', '.join(sorted(missing_roles))}")
    return resolved


def find_booking_conflicts(
    session: Session,
    *,
    participants: list[ParticipantSpec],
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: str | None = None,
) -> list[dict[str, Any]]:
    entity_ids = {participant.entity.id for participant in participants}
    session.execute(select(Entity.id).where(Entity.id.in_(entity_ids)).with_for_update()).all()
    statement = (
        select(BookingParticipant)
        .join(Booking)
        .where(
            BookingParticipant.entity_id.in_(entity_ids),
            Booking.start_at < end_at,
            Booking.end_at > start_at,
            Booking.status != BookingStatus.CANCELLED,
        )
        .options(
            selectinload(BookingParticipant.booking),
            selectinload(BookingParticipant.entity),
            selectinload(BookingParticipant.role_definition),
        )
    )
    if exclude_booking_id is not None:
        statement = statement.where(Booking.id != exclude_booking_id)

    requested_by_entity: dict[str, list[ParticipantSpec]] = {}
    for participant in participants:
        requested_by_entity.setdefault(participant.entity.id, []).append(participant)

    conflicts: list[dict[str, Any]] = []
    for existing in session.scalars(statement):
        for requested in requested_by_entity[existing.entity_id]:
            if not requested.role.is_exclusive and not existing.role_definition.is_exclusive:
                continue
            conflicts.append(
                {
                    "booking_id": existing.booking_id,
                    "entity_id": existing.entity_id,
                    "entity_name": existing.entity.name,
                    "requested_role_id": requested.role.id,
                    "requested_role_key": requested.role.key,
                    "conflicting_role_id": existing.role_definition.id,
                    "conflicting_role_key": existing.role_definition.key,
                    "start_at": existing.booking.start_at,
                    "end_at": existing.booking.end_at,
                }
            )
    return conflicts


def find_booking_overlap(
    session: Session,
    *,
    entity_id: str,
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: str | None = None,
) -> Booking | None:
    """Return the first active overlap in which the existing role is exclusive."""
    statement = (
        select(Booking)
        .join(BookingParticipant)
        .join(RoleDefinition)
        .where(
            BookingParticipant.entity_id == entity_id,
            RoleDefinition.is_exclusive.is_(True),
            Booking.start_at < end_at,
            Booking.end_at > start_at,
            Booking.status != BookingStatus.CANCELLED,
        )
    )
    if exclude_booking_id is not None:
        statement = statement.where(Booking.id != exclude_booking_id)
    return session.scalar(statement.limit(1))


def list_bookings(
    session: Session,
    *,
    range_start: datetime | None = None,
    range_end: datetime | None = None,
    entity_type_id: str | None = None,
    entity_id: str | None = None,
    role_definition_id: str | None = None,
    category_id: str | None = None,
    status: BookingStatus | None = None,
    search_query: str | None = None,
    field_filters: dict[str, Any] | None = None,
) -> list[Booking]:
    statement = booking_statement()
    if range_start is not None:
        statement = statement.where(Booking.end_at > range_start)
    if range_end is not None:
        statement = statement.where(Booking.start_at < range_end)
    if status is not None:
        statement = statement.where(Booking.status == status)
    if entity_id is not None:
        statement = statement.where(
            Booking.participants.any(BookingParticipant.entity_id == entity_id)
        )
    if role_definition_id is not None:
        statement = statement.where(
            Booking.participants.any(BookingParticipant.role_definition_id == role_definition_id)
        )
    if category_id is not None:
        statement = statement.where(
            Booking.participants.any(
                BookingParticipant.entity.has(
                    Entity.category_id.in_(category_descendant_ids(category_id))
                )
            )
        )

    if entity_type_id is not None or field_filters:
        matching_entities = list_entities(
            session,
            entity_type_id=entity_type_id,
            field_filters=field_filters,
            include_inactive=True,
        )
        matching_ids = [entity.id for entity in matching_entities]
        if not matching_ids:
            return []
        statement = statement.where(
            Booking.participants.any(BookingParticipant.entity_id.in_(matching_ids))
        )

    if search_query:
        matching_entities = list_entities(
            session,
            search_query=search_query,
            include_inactive=True,
        )
        matching_ids = [entity.id for entity in matching_entities]
        pattern = contains_pattern(search_query)
        statement = statement.where(
            or_(
                Booking.notes.ilike(pattern, escape="\\"),
                Booking.participants.any(BookingParticipant.entity_id.in_(matching_ids)),
            )
        )
    return list(session.scalars(statement.order_by(Booking.start_at, Booking.id)).unique())


def replace_participants(
    session: Session,
    booking: Booking,
    participants: list[ParticipantSpec],
) -> None:
    booking.participants.clear()
    session.flush()
    booking.participants.extend(
        BookingParticipant(
            entity=participant.entity,
            role_definition=participant.role,
            display_order=participant.display_order,
        )
        for participant in participants
    )


def serialize_booking(booking: Booking) -> dict[str, Any]:
    return {
        "id": booking.id,
        "start_at": booking.start_at,
        "end_at": booking.end_at,
        "status": booking.status,
        "notes": booking.notes,
        "participants": [
            {
                "id": participant.id,
                "entity_id": participant.entity_id,
                "entity_name": participant.entity.name,
                "entity_type_id": participant.entity.entity_type_id,
                "entity_type_key": participant.entity.entity_type.key,
                "role_definition_id": participant.role_definition_id,
                "role_key": participant.role_definition.key,
                "role_label": participant.role_definition.label,
                "booking_scope": participant.role_definition.booking_scope,
                "is_exclusive": participant.role_definition.is_exclusive,
                "resolved_color": resolve_entity_color(participant.entity),
                "display_order": participant.display_order,
                "created_at": participant.created_at,
                "updated_at": participant.updated_at,
            }
            for participant in booking.participants
        ],
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
    }
