from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models import BookingStatus
from app.schemas.booking import BookingCreate


def test_booking_schema_accepts_aware_interval_and_central_status() -> None:
    booking = BookingCreate(
        item_id="item-1",
        client_id="client-1",
        start_at=datetime(2026, 8, 24, 10, tzinfo=UTC),
        end_at=datetime(2026, 8, 24, 11, tzinfo=UTC),
    )

    assert booking.status is BookingStatus.CONFIRMED


def test_booking_schema_rejects_naive_timestamps() -> None:
    with pytest.raises(ValidationError, match="must include a timezone"):
        BookingCreate(
            item_id="item-1",
            client_id="client-1",
            start_at=datetime(2026, 8, 24, 10),
            end_at=datetime(2026, 8, 24, 11),
        )
