from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import StatementError
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    BookingParticipant,
    BookingStatus,
    Entity,
    EntityCategory,
    EntityType,
    RoleDefinition,
)


def persist_booking_dependencies(
    db_session: Session,
) -> tuple[Entity, RoleDefinition]:
    entity_type = EntityType(key="test_resource", name="Resource")
    role = RoleDefinition(
        key="test_resource",
        label="Resource",
        entity_type=entity_type,
        is_required=True,
        is_exclusive=True,
    )
    entity = Entity(name="Stoel 1", entity_type=entity_type)
    db_session.add_all([entity_type, role, entity])
    db_session.flush()
    return entity, role


def test_model_defaults_and_category_relationships(db_session: Session) -> None:
    entity_type = EntityType(key="rental_item", name="Verhuurartikel", color="#f59e0b")
    parent = EntityCategory(name="Materieel")
    child = EntityCategory(name="Tuingereedschap", parent=parent)
    entity = Entity(name="Heggenschaar", entity_type=entity_type, category=child)
    db_session.add_all([entity_type, parent, child, entity])
    db_session.commit()

    assert parent.is_active is True
    assert child.parent is parent
    assert parent.children == [child]
    assert entity.category is child
    assert child.entities == [entity]
    assert entity.entity_type is entity_type
    assert entity.is_active is True
    assert entity_type.color == "#F59E0B"


def test_category_cycle_is_rejected(db_session: Session) -> None:
    parent = EntityCategory(name="Parent")
    child = EntityCategory(name="Child", parent=parent)
    db_session.add_all([parent, child])
    db_session.commit()

    with pytest.raises(ValueError, match="cannot contain a cycle"):
        parent.parent = child


def test_category_with_children_cannot_be_deleted(db_session: Session) -> None:
    parent = EntityCategory(name="Parent")
    child = EntityCategory(name="Child", parent=parent)
    db_session.add_all([parent, child])
    db_session.commit()

    db_session.delete(parent)

    with pytest.raises(ValueError, match="deactivate it instead"):
        db_session.commit()


def test_deleting_leaf_category_uncategorizes_entity(db_session: Session) -> None:
    entity_type = EntityType(key="station", name="Station")
    category = EntityCategory(name="Stoelen")
    entity = Entity(name="Kappersstoel", entity_type=entity_type, category=category)
    db_session.add_all([entity_type, category, entity])
    db_session.commit()

    db_session.delete(category)
    db_session.commit()
    db_session.refresh(entity)

    assert entity.category_id is None


def test_invalid_color_is_rejected() -> None:
    with pytest.raises(ValueError, match="#RRGGBB"):
        EntityType(key="staff", name="Medewerker", color="pink")


def test_valid_booking_with_participant_is_normalized_to_utc(db_session: Session) -> None:
    entity, role = persist_booking_dependencies(db_session)
    start_at = datetime(2026, 8, 24, 10, tzinfo=timezone(timedelta(hours=2)))
    booking = Booking(start_at=start_at, end_at=start_at + timedelta(hours=1))
    booking.participants.append(
        BookingParticipant(entity=entity, role_definition=role, display_order=0)
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    assert booking.status is BookingStatus.CONFIRMED
    assert booking.start_at == datetime(2026, 8, 24, 8, tzinfo=UTC)
    assert booking.start_at.tzinfo is UTC
    assert booking.participants[0].entity is entity
    assert booking.participants[0].role_definition.is_exclusive is True


def test_naive_booking_timestamp_is_rejected(db_session: Session) -> None:
    booking = Booking(
        start_at=datetime(2026, 8, 24, 10),
        end_at=datetime(2026, 8, 24, 11),
    )
    db_session.add(booking)

    with pytest.raises(StatementError, match="must include a timezone"):
        db_session.commit()


@pytest.mark.parametrize(
    ("start_at", "end_at"),
    [
        (datetime(2026, 8, 24, 10, tzinfo=UTC), datetime(2026, 8, 24, 10, tzinfo=UTC)),
        (datetime(2026, 8, 24, 11, tzinfo=UTC), datetime(2026, 8, 24, 10, tzinfo=UTC)),
    ],
)
def test_invalid_booking_interval_is_rejected(
    db_session: Session,
    start_at: datetime,
    end_at: datetime,
) -> None:
    booking = Booking(start_at=start_at, end_at=end_at)
    db_session.add(booking)

    with pytest.raises(ValueError, match="end_at must be later"):
        db_session.commit()


def test_invalid_booking_status_is_rejected(db_session: Session) -> None:
    start_at = datetime(2026, 8, 24, 10, tzinfo=UTC)
    booking = Booking(
        start_at=start_at,
        end_at=start_at + timedelta(hours=1),
        status="unknown",
    )
    db_session.add(booking)

    with pytest.raises(StatementError, match="unknown"):
        db_session.commit()
