from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EntityType, FieldDataType, FieldDefinition, RoleDefinition


@dataclass(frozen=True)
class FieldPreset:
    key: str
    label: str
    data_type: FieldDataType
    required: bool = False
    searchable: bool = False
    filterable: bool = False
    options: tuple[str, ...] = ()


@dataclass(frozen=True)
class EntityTypePreset:
    key: str
    name: str
    role_key: str
    role_label: str
    required: bool
    exclusive: bool
    color: str
    fields: tuple[FieldPreset, ...] = field(default_factory=tuple)


PRESETS: dict[str, tuple[EntityTypePreset, ...]] = {
    "hair_salon": (
        EntityTypePreset(
            "salon_customer",
            "Klant",
            "salon_customer",
            "Klant",
            True,
            False,
            "#64748B",
            (FieldPreset("phone", "Telefoon", FieldDataType.TEXT, searchable=True),),
        ),
        EntityTypePreset("hairdresser", "Kapster", "hairdresser", "Kapster", True, True, "#EC4899"),
        EntityTypePreset(
            "salon_station", "Stoel", "salon_station", "Stoel", False, True, "#8B5CF6"
        ),
    ),
    "rental": (
        EntityTypePreset(
            "rental_customer",
            "Klant",
            "rental_customer",
            "Klant",
            True,
            False,
            "#64748B",
            (FieldPreset("phone", "Telefoon", FieldDataType.TEXT, searchable=True),),
        ),
        EntityTypePreset(
            "rental_item",
            "Verhuurartikel",
            "rental_item",
            "Verhuurartikel",
            True,
            True,
            "#F59E0B",
            (
                FieldPreset("description", "Omschrijving", FieldDataType.TEXT, searchable=True),
                FieldPreset("brand", "Merk", FieldDataType.TEXT, filterable=True),
                FieldPreset("model", "Type", FieldDataType.TEXT, filterable=True),
                FieldPreset("registration", "Kenteken", FieldDataType.TEXT, searchable=True),
            ),
        ),
        EntityTypePreset(
            "rental_staff",
            "Medewerker",
            "rental_staff",
            "Medewerker",
            False,
            True,
            "#14B8A6",
        ),
    ),
    "repair_workshop": (
        EntityTypePreset(
            "workpiece",
            "Werkstuk",
            "workpiece",
            "Werkstuk",
            True,
            False,
            "#64748B",
            (
                FieldPreset("serial_number", "Serienummer", FieldDataType.TEXT, searchable=True),
                FieldPreset("work_description", "Werkomschrijving", FieldDataType.TEXT),
                FieldPreset(
                    "work_status",
                    "Werkstatus",
                    FieldDataType.SELECT,
                    filterable=True,
                    options=("received", "in_progress", "ready"),
                ),
            ),
        ),
        EntityTypePreset("mechanic", "Monteur", "mechanic", "Monteur", True, True, "#0EA5E9"),
        EntityTypePreset("workbench", "Werkbank", "workbench", "Werkbank", True, True, "#22C55E"),
    ),
}


def apply_preset(session: Session, preset_key: str) -> list[EntityType]:
    if preset_key not in PRESETS:
        raise ValueError(f"unknown preset: {preset_key}")
    created_types: list[EntityType] = []
    for order, type_preset in enumerate(PRESETS[preset_key]):
        existing = session.scalar(select(EntityType).where(EntityType.key == type_preset.key))
        if existing is not None:
            created_types.append(existing)
            continue
        entity_type = EntityType(
            key=type_preset.key,
            name=type_preset.name,
            color=type_preset.color,
        )
        for field_order, field_preset in enumerate(type_preset.fields):
            entity_type.field_definitions.append(
                FieldDefinition(
                    key=field_preset.key,
                    label=field_preset.label,
                    data_type=field_preset.data_type,
                    is_required=field_preset.required,
                    is_searchable=field_preset.searchable,
                    is_filterable=field_preset.filterable,
                    display_order=field_order,
                    select_options=list(field_preset.options) or None,
                )
            )
        entity_type.role_definitions.append(
            RoleDefinition(
                key=type_preset.role_key,
                label=type_preset.role_label,
                is_required=type_preset.required,
                is_exclusive=type_preset.exclusive,
                display_order=order,
            )
        )
        session.add(entity_type)
        created_types.append(entity_type)
    session.flush()
    return created_types
