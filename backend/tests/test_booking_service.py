from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import Booking, BookingParticipant, Entity, EntityType, RoleDefinition
from app.services.booking_service import find_booking_overlap


def test_overlap_only_applies_to_exclusive_roles(db_session: Session) -> None:
    entity_type = EntityType(key="test_resource", name="Resource")
    exclusive_role = RoleDefinition(
        key="test_resource",
        label="Resource",
        entity_type=entity_type,
        is_exclusive=True,
    )
    nonexclusive_role = RoleDefinition(
        key="subject",
        label="Subject",
        entity_type=entity_type,
        is_exclusive=False,
    )
    exclusive_entity = Entity(name="Werkbank", entity_type=entity_type)
    nonexclusive_entity = Entity(name="Klep", entity_type=entity_type)
    start_at = datetime(2026, 8, 24, 10, tzinfo=UTC)
    booking = Booking(start_at=start_at, end_at=start_at + timedelta(hours=1))
    booking.participants.extend(
        [
            BookingParticipant(entity=exclusive_entity, role_definition=exclusive_role),
            BookingParticipant(entity=nonexclusive_entity, role_definition=nonexclusive_role),
        ]
    )
    db_session.add(booking)
    db_session.commit()

    assert (
        find_booking_overlap(
            db_session,
            entity_id=exclusive_entity.id,
            start_at=start_at + timedelta(minutes=30),
            end_at=start_at + timedelta(hours=2),
        )
        is booking
    )
    assert (
        find_booking_overlap(
            db_session,
            entity_id=nonexclusive_entity.id,
            start_at=start_at + timedelta(minutes=30),
            end_at=start_at + timedelta(hours=2),
        )
        is None
    )
