import pytest
from sqlalchemy.orm import Session

from app.models import FieldDataType
from app.services.presets import PRESETS, apply_preset


@pytest.mark.parametrize(
    ("preset_key", "expected_roles", "exclusive_roles"),
    [
        (
            "hair_salon",
            {"salon_customer", "hairdresser", "salon_station"},
            {"hairdresser", "salon_station"},
        ),
        (
            "rental",
            {"rental_customer", "rental_item", "rental_staff"},
            {"rental_item", "rental_staff"},
        ),
        ("repair_workshop", {"workpiece", "mechanic", "workbench"}, {"mechanic", "workbench"}),
    ],
)
def test_scenario_preset_defines_roles_and_exclusivity(
    db_session: Session,
    preset_key: str,
    expected_roles: set[str],
    exclusive_roles: set[str],
) -> None:
    entity_types = apply_preset(db_session, preset_key)
    roles = {
        role.key: role for entity_type in entity_types for role in entity_type.role_definitions
    }

    assert set(roles) == expected_roles
    assert {key for key, role in roles.items() if role.is_exclusive} == exclusive_roles


def test_presets_cover_requested_configurable_fields(db_session: Session) -> None:
    for preset_key in PRESETS:
        apply_preset(db_session, preset_key)

    rental_types = apply_preset(db_session, "rental")
    rental_item = next(
        entity_type for entity_type in rental_types if entity_type.key == "rental_item"
    )
    rental_fields = {definition.key for definition in rental_item.field_definitions}
    workshop_types = apply_preset(db_session, "repair_workshop")
    workpiece = next(
        entity_type for entity_type in workshop_types if entity_type.key == "workpiece"
    )
    work_status = next(
        definition for definition in workpiece.field_definitions if definition.key == "work_status"
    )

    assert {"description", "brand", "model", "registration"} <= rental_fields
    assert work_status.data_type is FieldDataType.SELECT
    assert work_status.select_options == ["received", "in_progress", "ready"]
