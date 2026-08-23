from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models import BookingStatus
from app.schemas.booking import BookingCreate, BookingParticipantCreate
from app.schemas.entity import EntityTypeCreate, FieldDefinitionCreate


def test_booking_schema_accepts_aware_interval_and_central_status() -> None:
    booking = BookingCreate(
        participants=[BookingParticipantCreate(entity_id="entity-1", role_definition_id="role-1")],
        start_at=datetime(2026, 8, 24, 10, tzinfo=UTC),
        end_at=datetime(2026, 8, 24, 11, tzinfo=UTC),
    )

    assert booking.status is BookingStatus.CONFIRMED


def test_booking_schema_rejects_naive_timestamps() -> None:
    with pytest.raises(ValidationError, match="must include a timezone"):
        BookingCreate(
            participants=[
                BookingParticipantCreate(entity_id="entity-1", role_definition_id="role-1")
            ],
            start_at=datetime(2026, 8, 24, 10),
            end_at=datetime(2026, 8, 24, 11),
        )


def test_booking_schema_requires_a_participant() -> None:
    with pytest.raises(ValidationError, match="at least 1"):
        BookingCreate(
            participants=[],
            start_at=datetime(2026, 8, 24, 10, tzinfo=UTC),
            end_at=datetime(2026, 8, 24, 11, tzinfo=UTC),
        )


def test_entity_type_schema_validates_field_configuration() -> None:
    entity_type = EntityTypeCreate(
        key="rental_item",
        name="Verhuurartikel",
        color="#f59e0b",
        fields=[
            FieldDefinitionCreate(
                key="size",
                label="Klasse",
                data_type="select",
                select_options=["small", "large"],
                is_filterable=True,
            )
        ],
    )

    assert entity_type.fields[0].select_options == ["small", "large"]


def test_non_select_field_rejects_select_options() -> None:
    with pytest.raises(ValidationError, match="only valid for select"):
        FieldDefinitionCreate(
            key="phone",
            label="Telefoon",
            data_type="text",
            select_options=["mobile"],
        )
