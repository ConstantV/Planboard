from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.api.routes.helpers import commit_or_conflict
from app.models import EntityType, FieldDefinition, RoleDefinition
from app.schemas.entity import (
    EntityTypeCreate,
    EntityTypeRead,
    EntityTypeUpdate,
    FieldDefinitionCreate,
    FieldDefinitionRead,
    FieldDefinitionUpdate,
    RoleDefinitionCreate,
    RoleDefinitionRead,
    RoleDefinitionUpdate,
)
from app.services.entity_service import EntityConfigurationError, validate_field_definition
from app.services.management_service import (
    entity_type_statement,
    serialize_entity_type,
    serialize_field_definition,
    serialize_role_definition,
    update_field_definition,
)
from app.services.presets import PRESETS, apply_preset

router = APIRouter()


def load_entity_type(session: Session, entity_type_id: str) -> EntityType:
    entity_type = session.scalar(entity_type_statement().where(EntityType.id == entity_type_id))
    if entity_type is None:
        raise ApiError(404, "entity_type_not_found", "EntityType does not exist")
    return entity_type


@router.get("/entity-types", response_model=list[EntityTypeRead])
def list_entity_types(
    session: DbSession,
    include_inactive: bool = False,
) -> list[dict]:
    statement = entity_type_statement().order_by(EntityType.name)
    if not include_inactive:
        statement = statement.where(EntityType.is_active.is_(True))
    return [serialize_entity_type(entity_type) for entity_type in session.scalars(statement)]


@router.post(
    "/entity-types",
    response_model=EntityTypeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_entity_type(
    payload: EntityTypeCreate,
    session: DbSession,
) -> dict:
    entity_type = EntityType(key=payload.key, name=payload.name, color=payload.color)
    for field_payload in payload.fields:
        definition = FieldDefinition(**field_payload.model_dump())
        validate_field_definition(definition)
        entity_type.field_definitions.append(definition)
    session.add(entity_type)
    commit_or_conflict(session, "EntityType or field key already exists")
    return serialize_entity_type(load_entity_type(session, entity_type.id))


@router.get("/entity-types/{entity_type_id}", response_model=EntityTypeRead)
def get_entity_type(entity_type_id: str, session: DbSession) -> dict:
    return serialize_entity_type(load_entity_type(session, entity_type_id))


@router.patch("/entity-types/{entity_type_id}", response_model=EntityTypeRead)
def update_entity_type_route(
    entity_type_id: str,
    payload: EntityTypeUpdate,
    session: DbSession,
) -> dict:
    entity_type = load_entity_type(session, entity_type_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity_type, key, value)
    commit_or_conflict(session, "EntityType key already exists")
    return serialize_entity_type(load_entity_type(session, entity_type.id))


@router.post("/entity-types/{entity_type_id}/deactivate", response_model=EntityTypeRead)
def deactivate_entity_type(entity_type_id: str, session: DbSession) -> dict:
    entity_type = load_entity_type(session, entity_type_id)
    entity_type.is_active = False
    session.commit()
    return serialize_entity_type(entity_type)


@router.post(
    "/entity-types/{entity_type_id}/fields",
    response_model=FieldDefinitionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_field_definition(
    entity_type_id: str,
    payload: FieldDefinitionCreate,
    session: DbSession,
) -> dict:
    entity_type = load_entity_type(session, entity_type_id)
    if not entity_type.is_active:
        raise ApiError(422, "inactive_entity_type", "Cannot add fields to an inactive EntityType")
    definition = FieldDefinition(entity_type=entity_type, **payload.model_dump())
    validate_field_definition(definition)
    session.add(definition)
    commit_or_conflict(session, "Field key already exists for this EntityType")
    return serialize_field_definition(definition)


@router.patch("/field-definitions/{field_id}", response_model=FieldDefinitionRead)
def update_field_definition_route(
    field_id: str,
    payload: FieldDefinitionUpdate,
    session: DbSession,
) -> dict:
    definition = session.get(FieldDefinition, field_id)
    if definition is None:
        raise ApiError(404, "field_definition_not_found", "FieldDefinition does not exist")
    try:
        update_field_definition(
            session,
            definition,
            payload.model_dump(exclude_unset=True),
        )
    except EntityConfigurationError as error:
        session.rollback()
        raise ApiError(422, "invalid_field_definition", str(error)) from error
    commit_or_conflict(session, "Field key already exists for this EntityType")
    return serialize_field_definition(definition)


@router.post("/field-definitions/{field_id}/deactivate", response_model=FieldDefinitionRead)
def deactivate_field_definition(
    field_id: str,
    session: DbSession,
) -> dict:
    definition = session.get(FieldDefinition, field_id)
    if definition is None:
        raise ApiError(404, "field_definition_not_found", "FieldDefinition does not exist")
    definition.is_active = False
    session.commit()
    return serialize_field_definition(definition)


@router.get("/role-definitions", response_model=list[RoleDefinitionRead])
def list_role_definitions(
    session: DbSession,
    entity_type_id: str | None = None,
    include_inactive: bool = False,
) -> list[dict]:
    statement = select(RoleDefinition).order_by(RoleDefinition.display_order, RoleDefinition.label)
    if entity_type_id is not None:
        statement = statement.where(RoleDefinition.entity_type_id == entity_type_id)
    if not include_inactive:
        statement = statement.where(RoleDefinition.is_active.is_(True))
    return [serialize_role_definition(role) for role in session.scalars(statement)]


@router.post(
    "/role-definitions",
    response_model=RoleDefinitionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_role_definition(
    payload: RoleDefinitionCreate,
    session: DbSession,
) -> dict:
    entity_type = load_entity_type(session, payload.entity_type_id)
    if not entity_type.is_active:
        raise ApiError(422, "inactive_entity_type", "Cannot add roles to an inactive EntityType")
    role = RoleDefinition(**payload.model_dump())
    session.add(role)
    commit_or_conflict(session, "Role key already exists")
    return serialize_role_definition(role)


@router.patch("/role-definitions/{role_id}", response_model=RoleDefinitionRead)
def update_role_definition(
    role_id: str,
    payload: RoleDefinitionUpdate,
    session: DbSession,
) -> dict:
    role = session.get(RoleDefinition, role_id)
    if role is None:
        raise ApiError(404, "role_definition_not_found", "RoleDefinition does not exist")
    changes = payload.model_dump(exclude_unset=True)
    if "entity_type_id" in changes and changes["entity_type_id"] != role.entity_type_id:
        if role.booking_participants:
            raise ApiError(
                422,
                "role_in_use",
                "Cannot change EntityType while the role is used by Bookings",
            )
        load_entity_type(session, changes["entity_type_id"])
    for key, value in changes.items():
        setattr(role, key, value)
    commit_or_conflict(session, "Role key already exists")
    return serialize_role_definition(role)


@router.post("/role-definitions/{role_id}/deactivate", response_model=RoleDefinitionRead)
def deactivate_role_definition(role_id: str, session: DbSession) -> dict:
    role = session.get(RoleDefinition, role_id)
    if role is None:
        raise ApiError(404, "role_definition_not_found", "RoleDefinition does not exist")
    role.is_active = False
    session.commit()
    return serialize_role_definition(role)


@router.post("/presets/{preset_key}", response_model=list[EntityTypeRead])
def install_preset(preset_key: str, session: DbSession) -> list[dict]:
    if preset_key not in PRESETS:
        raise ApiError(404, "preset_not_found", "Preset does not exist")
    entity_types = apply_preset(session, preset_key)
    session.commit()
    return [serialize_entity_type(load_entity_type(session, item.id)) for item in entity_types]
