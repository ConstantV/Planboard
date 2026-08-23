from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import (
    Entity,
    EntityFieldValue,
    EntityType,
    FieldDataType,
    FieldDefinition,
)

DEFAULT_ENTITY_COLOR = "#3788D8"


class EntityConfigurationError(ValueError):
    pass


def validate_field_definition(definition: FieldDefinition) -> None:
    options = definition.select_options
    if definition.data_type is FieldDataType.SELECT:
        if not options or any(
            not isinstance(option, str) or not option.strip() for option in options
        ):
            raise EntityConfigurationError("select fields require non-empty string options")
        if len(set(options)) != len(options):
            raise EntityConfigurationError("select field options must be unique")
    elif options is not None:
        raise EntityConfigurationError("select_options are only valid for select fields")


def change_field_data_type(
    session: Session,
    definition: FieldDefinition,
    data_type: FieldDataType,
) -> None:
    has_values = session.scalar(
        select(EntityFieldValue.id)
        .where(EntityFieldValue.field_definition_id == definition.id)
        .limit(1)
    )
    if has_values is not None and definition.data_type is not data_type:
        raise EntityConfigurationError("cannot change datatype while field values exist")
    definition.data_type = data_type


def set_entity_values(session: Session, entity: Entity, values: dict[str, Any]) -> None:
    entity_type = entity.entity_type
    definitions = {
        definition.key: definition
        for definition in entity_type.field_definitions
        if definition.is_active is not False
    }
    unknown = set(values) - set(definitions)
    if unknown:
        raise EntityConfigurationError(f"unknown fields: {', '.join(sorted(unknown))}")

    missing = [
        definition.key
        for definition in definitions.values()
        if definition.is_required
        and (definition.key not in values or values[definition.key] is None)
    ]
    if missing:
        raise EntityConfigurationError(f"missing required fields: {', '.join(sorted(missing))}")

    active_definition_ids = {definition.id for definition in definitions.values()}
    current_values = {
        field_value.field_definition_id: field_value
        for field_value in entity.field_values
        if field_value.field_definition_id in active_definition_ids
    }
    entity.field_values[:] = [
        field_value
        for field_value in entity.field_values
        if field_value.field_definition_id not in active_definition_ids
        or (
            field_value.field_definition.key in values
            and values[field_value.field_definition.key] is not None
        )
    ]
    for key, raw_value in values.items():
        if raw_value is None:
            continue
        definition = definitions[key]
        validate_field_definition(definition)
        current = current_values.get(definition.id)
        if current is None:
            entity.field_values.append(build_field_value(definition, raw_value))
            continue
        set_field_value(current, definition, raw_value)
    session.add(entity)


def build_field_value(definition: FieldDefinition, raw_value: Any) -> EntityFieldValue:
    value = EntityFieldValue(field_definition=definition)
    set_field_value(value, definition, raw_value)
    return value


def set_field_value(
    value: EntityFieldValue,
    definition: FieldDefinition,
    raw_value: Any,
) -> None:
    value.text_value = None
    value.number_value = None
    value.boolean_value = None
    value.date_value = None
    data_type = definition.data_type

    if data_type is FieldDataType.TEXT:
        if not isinstance(raw_value, str):
            raise EntityConfigurationError(f"{definition.key} must be text")
        value.text_value = raw_value
    elif data_type is FieldDataType.SELECT:
        if not isinstance(raw_value, str) or raw_value not in (definition.select_options or []):
            raise EntityConfigurationError(
                f"{definition.key} must be one of the configured options"
            )
        value.text_value = raw_value
    elif data_type is FieldDataType.NUMBER:
        if isinstance(raw_value, bool):
            raise EntityConfigurationError(f"{definition.key} must be a number")
        try:
            value.number_value = Decimal(str(raw_value))
        except (InvalidOperation, ValueError) as error:
            raise EntityConfigurationError(f"{definition.key} must be a number") from error
    elif data_type is FieldDataType.BOOLEAN:
        if not isinstance(raw_value, bool):
            raise EntityConfigurationError(f"{definition.key} must be a boolean")
        value.boolean_value = raw_value
    elif data_type is FieldDataType.DATE:
        if isinstance(raw_value, datetime):
            raise EntityConfigurationError(f"{definition.key} must be a date without time")
        if isinstance(raw_value, str):
            try:
                raw_value = date.fromisoformat(raw_value)
            except ValueError as error:
                raise EntityConfigurationError(f"{definition.key} must be an ISO date") from error
        if not isinstance(raw_value, date):
            raise EntityConfigurationError(f"{definition.key} must be a date")
        value.date_value = raw_value


def get_entity_values(entity: Entity) -> dict[str, Any]:
    return {
        field_value.field_definition.key: field_value.value for field_value in entity.field_values
    }


def filter_entities(
    session: Session,
    entity_type_key: str,
    field_filters: dict[str, Any],
) -> list[Entity]:
    entity_type = session.scalar(select(EntityType).where(EntityType.key == entity_type_key))
    if entity_type is None:
        raise EntityConfigurationError(f"unknown entity type: {entity_type_key}")
    definitions = {definition.key: definition for definition in entity_type.field_definitions}
    statement = select(Entity).where(Entity.entity_type_id == entity_type.id)

    for key, raw_value in field_filters.items():
        definition = definitions.get(key)
        if definition is None or not definition.is_filterable:
            raise EntityConfigurationError(f"field is not filterable: {key}")
        typed_value = build_field_value(definition, raw_value)
        value_column = field_value_column(definition.data_type)
        expected_value = getattr(typed_value, value_column.key)
        statement = statement.where(
            Entity.field_values.any(
                (EntityFieldValue.field_definition_id == definition.id)
                & (value_column == expected_value)
            )
        )

    return list(session.scalars(statement.order_by(Entity.name)))


def search_entities(session: Session, entity_type_key: str, query: str) -> list[Entity]:
    entity_type = session.scalar(select(EntityType).where(EntityType.key == entity_type_key))
    if entity_type is None:
        raise EntityConfigurationError(f"unknown entity type: {entity_type_key}")
    searchable_ids = [
        definition.id
        for definition in entity_type.field_definitions
        if definition.is_searchable
        and definition.data_type in {FieldDataType.TEXT, FieldDataType.SELECT}
    ]
    pattern = f"%{query}%"
    custom_match = Entity.field_values.any(
        (EntityFieldValue.field_definition_id.in_(searchable_ids))
        & EntityFieldValue.text_value.ilike(pattern)
    )
    statement = (
        select(Entity)
        .where(Entity.entity_type_id == entity_type.id)
        .where(or_(Entity.name.ilike(pattern), custom_match))
        .order_by(Entity.name)
    )
    return list(session.scalars(statement))


def field_value_column(data_type: FieldDataType):
    if data_type in {FieldDataType.TEXT, FieldDataType.SELECT}:
        return EntityFieldValue.text_value
    if data_type is FieldDataType.NUMBER:
        return EntityFieldValue.number_value
    if data_type is FieldDataType.BOOLEAN:
        return EntityFieldValue.boolean_value
    return EntityFieldValue.date_value


def resolve_entity_color(entity: Entity) -> str:
    return (
        entity.color
        or (entity.category.color if entity.category is not None else None)
        or entity.entity_type.color
        or DEFAULT_ENTITY_COLOR
    )
