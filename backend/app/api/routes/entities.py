from fastapi import APIRouter, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.api.routes.categories import load_category
from app.api.routes.configuration import load_entity_type
from app.api.routes.helpers import parse_field_filters
from app.models import Entity
from app.schemas.entity import EntityCreate, EntityRead, EntityUpdate
from app.services.entity_service import EntityConfigurationError, set_entity_values
from app.services.management_service import entity_statement, list_entities, serialize_entity

router = APIRouter()


def load_entity(session: Session, entity_id: str) -> Entity:
    entity = session.scalar(entity_statement().where(Entity.id == entity_id))
    if entity is None:
        raise ApiError(404, "entity_not_found", "Entity does not exist")
    return entity


def active_category(session: Session, category_id: str | None):
    if category_id is None:
        return None
    category = load_category(session, category_id)
    if not category.is_active:
        raise ApiError(422, "inactive_category", "Cannot assign an inactive category")
    return category


@router.get("/entities", response_model=list[EntityRead])
def list_entities_route(
    session: DbSession,
    entity_type_id: str | None = None,
    category_id: str | None = None,
    search: str | None = Query(default=None, max_length=160),
    filters: str | None = Query(default=None, description='JSON object, e.g. {"brand":"Ford"}'),
    include_inactive: bool = False,
) -> list[dict]:
    if entity_type_id is not None:
        load_entity_type(session, entity_type_id)
    if category_id is not None:
        load_category(session, category_id)
    try:
        entities = list_entities(
            session,
            entity_type_id=entity_type_id,
            category_id=category_id,
            search_query=search,
            field_filters=parse_field_filters(filters),
            include_inactive=include_inactive,
        )
    except EntityConfigurationError as error:
        raise ApiError(422, "invalid_entity_filter", str(error)) from error
    return [serialize_entity(entity) for entity in entities]


@router.post("/entities", response_model=EntityRead, status_code=status.HTTP_201_CREATED)
def create_entity(payload: EntityCreate, session: DbSession) -> dict:
    entity_type = load_entity_type(session, payload.entity_type_id)
    if not entity_type.is_active:
        raise ApiError(422, "inactive_entity_type", "Cannot use an inactive EntityType")
    entity = Entity(
        name=payload.name,
        entity_type=entity_type,
        category=active_category(session, payload.category_id),
        color=payload.color,
    )
    try:
        set_entity_values(session, entity, payload.values)
        session.commit()
    except EntityConfigurationError as error:
        session.rollback()
        raise ApiError(422, "invalid_entity_values", str(error)) from error
    return serialize_entity(load_entity(session, entity.id))


@router.get("/entities/{entity_id}", response_model=EntityRead)
def get_entity(entity_id: str, session: DbSession) -> dict:
    return serialize_entity(load_entity(session, entity_id))


@router.patch("/entities/{entity_id}", response_model=EntityRead)
def update_entity(
    entity_id: str,
    payload: EntityUpdate,
    session: DbSession,
) -> dict:
    entity = load_entity(session, entity_id)
    changes = payload.model_dump(exclude_unset=True)
    values = changes.pop("values", None)
    try:
        if "entity_type_id" in changes:
            new_type_id = changes.pop("entity_type_id")
            if new_type_id != entity.entity_type_id:
                if values is None:
                    raise EntityConfigurationError("values are required when changing EntityType")
                new_type = load_entity_type(session, new_type_id)
                if not new_type.is_active:
                    raise EntityConfigurationError("Cannot use an inactive EntityType")
                entity.entity_type = new_type
        if "category_id" in changes:
            entity.category = active_category(session, changes.pop("category_id"))
        for key, value in changes.items():
            setattr(entity, key, value)
        if values is not None:
            set_entity_values(session, entity, values)
        session.commit()
    except EntityConfigurationError as error:
        session.rollback()
        raise ApiError(422, "invalid_entity", str(error)) from error
    return serialize_entity(load_entity(session, entity.id))


@router.post("/entities/{entity_id}/deactivate", response_model=EntityRead)
def deactivate_entity(entity_id: str, session: DbSession) -> dict:
    entity = load_entity(session, entity_id)
    entity.is_active = False
    session.commit()
    return serialize_entity(entity)
