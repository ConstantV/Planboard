from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models import Entity, EntityCategory, EntityType, FieldDataType, FieldDefinition
from app.services.entity_service import (
    DEFAULT_ENTITY_COLOR,
    EntityConfigurationError,
    change_field_data_type,
    filter_entities,
    get_entity_values,
    resolve_entity_color,
    search_entities,
    set_entity_values,
    validate_field_definition,
)


def configurable_type() -> EntityType:
    return EntityType(
        key="vehicle",
        name="Voertuig",
        field_definitions=[
            FieldDefinition(
                key="registration",
                label="Kenteken",
                data_type=FieldDataType.TEXT,
                is_required=True,
                is_searchable=True,
                is_filterable=True,
            ),
            FieldDefinition(
                key="daily_rate",
                label="Dagtarief",
                data_type=FieldDataType.NUMBER,
                is_filterable=True,
            ),
            FieldDefinition(
                key="electric",
                label="Elektrisch",
                data_type=FieldDataType.BOOLEAN,
                is_filterable=True,
            ),
            FieldDefinition(
                key="available_from",
                label="Beschikbaar vanaf",
                data_type=FieldDataType.DATE,
                is_filterable=True,
            ),
            FieldDefinition(
                key="size",
                label="Klasse",
                data_type=FieldDataType.SELECT,
                select_options=["small", "large"],
                is_filterable=True,
            ),
        ],
    )


def test_typed_values_are_validated_and_round_trip(db_session: Session) -> None:
    entity_type = configurable_type()
    entity = Entity(name="Bestelbus", entity_type=entity_type)
    db_session.add(entity_type)
    set_entity_values(
        db_session,
        entity,
        {
            "registration": "V-123-AB",
            "daily_rate": "89.50",
            "electric": True,
            "available_from": "2026-09-01",
            "size": "large",
        },
    )
    db_session.commit()

    assert get_entity_values(entity) == {
        "registration": "V-123-AB",
        "daily_rate": Decimal("89.5000"),
        "electric": True,
        "available_from": date(2026, 9, 1),
        "size": "large",
    }


@pytest.mark.parametrize(
    ("values", "message"),
    [
        ({}, "missing required fields"),
        ({"registration": "V-1", "unknown": "x"}, "unknown fields"),
        ({"registration": "V-1", "daily_rate": True}, "must be a number"),
        ({"registration": "V-1", "electric": "yes"}, "must be a boolean"),
        ({"registration": "V-1", "available_from": "tomorrow"}, "must be an ISO date"),
        ({"registration": "V-1", "size": "medium"}, "configured options"),
    ],
)
def test_invalid_custom_values_are_rejected(
    db_session: Session,
    values: dict,
    message: str,
) -> None:
    entity_type = configurable_type()
    entity = Entity(name="Bestelbus", entity_type=entity_type)
    db_session.add(entity_type)

    with pytest.raises(EntityConfigurationError, match=message):
        set_entity_values(db_session, entity, values)


def test_select_definition_rules_and_datatype_lifecycle(db_session: Session) -> None:
    invalid_select = FieldDefinition(
        key="status",
        label="Status",
        data_type=FieldDataType.SELECT,
        select_options=[],
    )
    with pytest.raises(EntityConfigurationError, match="require non-empty"):
        validate_field_definition(invalid_select)

    entity_type = configurable_type()
    entity = Entity(name="Bestelbus", entity_type=entity_type)
    db_session.add(entity_type)
    set_entity_values(db_session, entity, {"registration": "V-123-AB"})
    db_session.commit()
    registration = next(
        definition
        for definition in entity_type.field_definitions
        if definition.key == "registration"
    )

    with pytest.raises(EntityConfigurationError, match="while field values exist"):
        change_field_data_type(db_session, registration, FieldDataType.NUMBER)


def test_filtering_and_search_use_configured_fields(db_session: Session) -> None:
    entity_type = configurable_type()
    first = Entity(name="Bus Noord", entity_type=entity_type)
    second = Entity(name="Bus Zuid", entity_type=entity_type)
    db_session.add(entity_type)
    set_entity_values(
        db_session,
        first,
        {"registration": "V-111-AA", "daily_rate": 80, "electric": True, "size": "large"},
    )
    set_entity_values(
        db_session,
        second,
        {"registration": "V-222-BB", "daily_rate": 80, "electric": False, "size": "small"},
    )
    db_session.commit()

    assert filter_entities(
        db_session, "vehicle", {"daily_rate": 80, "electric": True, "size": "large"}
    ) == [first]
    assert search_entities(db_session, "vehicle", "222-bb") == [second]
    assert search_entities(db_session, "vehicle", "noord") == [first]

    with pytest.raises(EntityConfigurationError, match="not filterable"):
        filter_entities(db_session, "vehicle", {"not_configured": "x"})


def test_filtering_representative_configurable_dataset(db_session: Session) -> None:
    entity_type = configurable_type()
    db_session.add(entity_type)
    expected_names = []
    for index in range(250):
        entity = Entity(name=f"Voertuig {index:03}", entity_type=entity_type)
        is_electric_large = index % 10 == 0
        set_entity_values(
            db_session,
            entity,
            {
                "registration": f"V-{index:03}",
                "daily_rate": 100 + (index % 5),
                "electric": is_electric_large,
                "size": "large" if is_electric_large else "small",
            },
        )
        if is_electric_large:
            expected_names.append(entity.name)
    db_session.commit()

    matches = filter_entities(
        db_session,
        "vehicle",
        {"electric": True, "size": "large"},
    )

    assert [entity.name for entity in matches] == expected_names


def test_color_precedence() -> None:
    entity_type = EntityType(key="staff", name="Medewerker", color="#111111")
    category = EntityCategory(name="Kapsters", color="#222222")
    entity = Entity(
        name="Robin",
        entity_type=entity_type,
        category=category,
        color="#333333",
    )

    assert resolve_entity_color(entity) == "#333333"
    entity.color = None
    assert resolve_entity_color(entity) == "#222222"
    category.color = None
    assert resolve_entity_color(entity) == "#111111"
    entity_type.color = None
    assert resolve_entity_color(entity) == DEFAULT_ENTITY_COLOR
