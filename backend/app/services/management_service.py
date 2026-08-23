from __future__ import annotations

from typing import Any

from sqlalchemy import Select, exists, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Entity,
    EntityCategory,
    EntityFieldValue,
    EntityType,
    FieldDataType,
    FieldDefinition,
    RoleDefinition,
)
from app.services.entity_service import (
    EntityConfigurationError,
    build_field_value,
    change_field_data_type,
    contains_pattern,
    field_value_column,
    get_entity_values,
    resolve_entity_color,
    validate_field_definition,
)


def entity_type_statement() -> Select:
    return select(EntityType).options(
        selectinload(EntityType.field_definitions),
        selectinload(EntityType.role_definitions),
    )


def entity_statement() -> Select:
    return select(Entity).options(
        selectinload(Entity.entity_type),
        selectinload(Entity.category).selectinload(EntityCategory.parent),
        selectinload(Entity.field_values).selectinload(EntityFieldValue.field_definition),
    )


def category_path(category: EntityCategory | None) -> list[str]:
    path: list[str] = []
    visited: set[str] = set()
    current = category
    while current is not None:
        if current.id in visited:
            raise EntityConfigurationError("entity category hierarchy contains a cycle")
        visited.add(current.id)
        path.append(current.name)
        current = current.parent
    return list(reversed(path))


def category_descendant_ids(category_id: str):
    hierarchy = (
        select(EntityCategory.id)
        .where(EntityCategory.id == category_id)
        .cte(name="category_hierarchy", recursive=True)
    )
    hierarchy = hierarchy.union_all(
        select(EntityCategory.id).where(EntityCategory.parent_id == hierarchy.c.id)
    )
    return select(hierarchy.c.id)


def list_entities(
    session: Session,
    *,
    entity_type_id: str | None = None,
    category_id: str | None = None,
    search_query: str | None = None,
    field_filters: dict[str, Any] | None = None,
    include_inactive: bool = False,
) -> list[Entity]:
    statement = entity_statement()
    if not include_inactive:
        statement = statement.where(Entity.is_active.is_(True))
    if entity_type_id is not None:
        statement = statement.where(Entity.entity_type_id == entity_type_id)
    if category_id is not None:
        statement = statement.where(Entity.category_id.in_(category_descendant_ids(category_id)))

    definitions: dict[str, FieldDefinition] = {}
    if entity_type_id is not None:
        definitions = {
            definition.key: definition
            for definition in session.scalars(
                select(FieldDefinition).where(
                    FieldDefinition.entity_type_id == entity_type_id,
                    FieldDefinition.is_active.is_(True),
                )
            )
        }
    if field_filters:
        if entity_type_id is None:
            raise EntityConfigurationError("custom field filters require entity_type_id")
        for key, raw_value in field_filters.items():
            definition = definitions.get(key)
            if definition is None or not definition.is_filterable:
                raise EntityConfigurationError(f"field is not filterable: {key}")
            typed_value = build_field_value(definition, raw_value)
            value_column = field_value_column(definition.data_type)
            statement = statement.where(
                Entity.field_values.any(
                    (EntityFieldValue.field_definition_id == definition.id)
                    & (value_column == getattr(typed_value, value_column.key))
                )
            )

    if search_query:
        searchable_query = select(FieldDefinition.id).where(
            FieldDefinition.is_active.is_(True),
            FieldDefinition.is_searchable.is_(True),
            FieldDefinition.data_type.in_([FieldDataType.TEXT, FieldDataType.SELECT]),
        )
        if entity_type_id is not None:
            searchable_query = searchable_query.where(
                FieldDefinition.entity_type_id == entity_type_id
            )
        pattern = contains_pattern(search_query)
        statement = statement.where(
            or_(
                Entity.name.ilike(pattern, escape="\\"),
                Entity.field_values.any(
                    EntityFieldValue.field_definition_id.in_(searchable_query)
                    & EntityFieldValue.text_value.ilike(pattern, escape="\\")
                ),
            )
        )
    return list(session.scalars(statement.order_by(Entity.name)).unique())


def validate_required_field_change(
    session: Session,
    definition: FieldDefinition,
    is_required: bool,
) -> None:
    if not is_required or definition.is_required:
        return
    missing_value = session.scalar(
        select(Entity.id)
        .where(
            Entity.entity_type_id == definition.entity_type_id,
            ~exists(
                select(EntityFieldValue.id).where(
                    EntityFieldValue.entity_id == Entity.id,
                    EntityFieldValue.field_definition_id == definition.id,
                )
            ),
        )
        .limit(1)
    )
    if missing_value is not None:
        raise EntityConfigurationError(
            "field cannot become required while existing Entities have no value"
        )


def validate_select_option_change(
    session: Session,
    definition: FieldDefinition,
    options: list[str] | None,
) -> None:
    if definition.data_type is not FieldDataType.SELECT:
        return
    existing_values = set(
        session.scalars(
            select(EntityFieldValue.text_value).where(
                EntityFieldValue.field_definition_id == definition.id
            )
        )
    )
    if not existing_values.issubset(set(options or [])):
        raise EntityConfigurationError("select options cannot remove values that are in use")


def update_field_definition(
    session: Session,
    definition: FieldDefinition,
    changes: dict[str, Any],
) -> None:
    if "data_type" in changes:
        change_field_data_type(session, definition, changes.pop("data_type"))
    if "is_required" in changes:
        validate_required_field_change(session, definition, changes["is_required"])
    if "select_options" in changes:
        validate_select_option_change(session, definition, changes["select_options"])
    for key, value in changes.items():
        setattr(definition, key, value)
    validate_field_definition(definition)


def serialize_field_definition(definition: FieldDefinition) -> dict[str, Any]:
    return {
        "id": definition.id,
        "entity_type_id": definition.entity_type_id,
        "key": definition.key,
        "label": definition.label,
        "data_type": definition.data_type,
        "is_required": definition.is_required,
        "is_searchable": definition.is_searchable,
        "is_filterable": definition.is_filterable,
        "display_order": definition.display_order,
        "select_options": definition.select_options,
        "is_active": definition.is_active,
        "created_at": definition.created_at,
        "updated_at": definition.updated_at,
    }


def serialize_role_definition(role: RoleDefinition) -> dict[str, Any]:
    return {
        "id": role.id,
        "key": role.key,
        "label": role.label,
        "booking_scope": role.booking_scope,
        "entity_type_id": role.entity_type_id,
        "is_required": role.is_required,
        "allow_multiple": role.allow_multiple,
        "is_exclusive": role.is_exclusive,
        "display_order": role.display_order,
        "is_active": role.is_active,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    }


def serialize_entity_type(entity_type: EntityType) -> dict[str, Any]:
    return {
        "id": entity_type.id,
        "key": entity_type.key,
        "name": entity_type.name,
        "color": entity_type.color,
        "is_active": entity_type.is_active,
        "fields": [
            serialize_field_definition(definition) for definition in entity_type.field_definitions
        ],
        "roles": [serialize_role_definition(role) for role in entity_type.role_definitions],
        "created_at": entity_type.created_at,
        "updated_at": entity_type.updated_at,
    }


def serialize_category(category: EntityCategory) -> dict[str, Any]:
    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "color": category.color,
        "is_active": category.is_active,
        "path": category_path(category),
        "created_at": category.created_at,
        "updated_at": category.updated_at,
    }


def serialize_entity(entity: Entity) -> dict[str, Any]:
    return {
        "id": entity.id,
        "name": entity.name,
        "entity_type_id": entity.entity_type_id,
        "entity_type_key": entity.entity_type.key,
        "entity_type_name": entity.entity_type.name,
        "category_id": entity.category_id,
        "category_path": category_path(entity.category),
        "color": entity.color,
        "resolved_color": resolve_entity_color(entity),
        "is_active": entity.is_active,
        "values": get_entity_values(entity),
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }
