from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import StatementError
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Client, Item, ItemCategory


def persist_booking_dependencies(db_session: Session) -> tuple[Item, Client]:
    item = Item(name="Stoel 1")
    client = Client(name="Ada Lovelace")
    db_session.add_all([item, client])
    db_session.flush()
    return item, client


def test_model_defaults_and_category_relationships(db_session: Session) -> None:
    parent = ItemCategory(name="Materieel")
    child = ItemCategory(name="Tuingereedschap", parent=parent)
    item = Item(name="Heggenschaar", category=child)
    client = Client(name="Ada Lovelace")
    db_session.add_all([parent, child, item, client])
    db_session.commit()

    assert parent.is_active is True
    assert child.parent is parent
    assert parent.children == [child]
    assert item.category is child
    assert child.items == [item]
    assert item.item_type == "resource"
    assert item.is_active is True
    assert client.is_archived is False


def test_category_cycle_is_rejected(db_session: Session) -> None:
    parent = ItemCategory(name="Parent")
    child = ItemCategory(name="Child", parent=parent)
    db_session.add_all([parent, child])
    db_session.commit()

    with pytest.raises(ValueError, match="cannot contain a cycle"):
        parent.parent = child


def test_category_with_children_cannot_be_deleted(db_session: Session) -> None:
    parent = ItemCategory(name="Parent")
    child = ItemCategory(name="Child", parent=parent)
    db_session.add_all([parent, child])
    db_session.commit()

    db_session.delete(parent)

    with pytest.raises(ValueError, match="deactivate it instead"):
        db_session.commit()


def test_deleting_leaf_category_uncategorizes_item(db_session: Session) -> None:
    category = ItemCategory(name="Stoelen")
    item = Item(name="Kappersstoel", category=category)
    db_session.add_all([category, item])
    db_session.commit()

    db_session.delete(category)
    db_session.commit()
    db_session.refresh(item)

    assert item.category_id is None


def test_valid_booking_is_normalized_to_utc(db_session: Session) -> None:
    item, client = persist_booking_dependencies(db_session)
    start_at = datetime(2026, 8, 24, 10, tzinfo=timezone(timedelta(hours=2)))
    booking = Booking(
        item=item,
        client=client,
        start_at=start_at,
        end_at=start_at + timedelta(hours=1),
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    assert booking.status is BookingStatus.CONFIRMED
    assert booking.start_at == datetime(2026, 8, 24, 8, tzinfo=UTC)
    assert booking.start_at.tzinfo is UTC


def test_naive_booking_timestamp_is_rejected(db_session: Session) -> None:
    item, client = persist_booking_dependencies(db_session)
    booking = Booking(
        item=item,
        client=client,
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
    item, client = persist_booking_dependencies(db_session)
    booking = Booking(item=item, client=client, start_at=start_at, end_at=end_at)
    db_session.add(booking)

    with pytest.raises(ValueError, match="end_at must be later"):
        db_session.commit()


def test_invalid_booking_status_is_rejected(db_session: Session) -> None:
    item, client = persist_booking_dependencies(db_session)
    start_at = datetime(2026, 8, 24, 10, tzinfo=UTC)
    booking = Booking(
        item=item,
        client=client,
        start_at=start_at,
        end_at=start_at + timedelta(hours=1),
        status="unknown",
    )
    db_session.add(booking)

    with pytest.raises(StatementError, match="unknown"):
        db_session.commit()
