from datetime import datetime

from fastapi import APIRouter, Query

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.api.routes.categories import load_category
from app.api.routes.configuration import load_entity_type
from app.api.routes.entities import load_entity
from app.api.routes.helpers import parse_field_filters
from app.services.availability_service import (
    BookingValidationError,
    find_available_entities,
    occupancy_for_entity,
)
from app.services.entity_service import EntityConfigurationError
from app.services.management_service import serialize_entity

router = APIRouter()


@router.get("/availability")
def find_available_entities_route(
    session: DbSession,
    start_at: datetime,
    end_at: datetime,
    role_definition_id: str | None = None,
    entity_type_id: str | None = None,
    category_id: str | None = None,
    filters: str | None = Query(default=None, description='JSON object, e.g. {"brand":"Ford"}'),
    exclude_booking_id: str | None = None,
) -> list[dict]:
    try:
        if entity_type_id is not None:
            load_entity_type(session, entity_type_id)
        if category_id is not None:
            load_category(session, category_id)
        entities = find_available_entities(
            session,
            start_at=start_at,
            end_at=end_at,
            role_definition_id=role_definition_id,
            entity_type_id=entity_type_id,
            category_id=category_id,
            filters=parse_field_filters(filters),
            exclude_booking_id=exclude_booking_id,
        )
    except (BookingValidationError, EntityConfigurationError) as error:
        raise ApiError(422, "invalid_availability_request", str(error)) from error
    return [serialize_entity(entity) for entity in entities]


@router.get("/entities/{entity_id}/occupancy")
def entity_occupancy_route(
    entity_id: str,
    session: DbSession,
    range_start: datetime,
    range_end: datetime,
) -> dict:
    try:
        load_entity(session, entity_id)
        return occupancy_for_entity(
            session,
            entity_id=entity_id,
            range_start=range_start,
            range_end=range_end,
        )
    except BookingValidationError as error:
        raise ApiError(422, "invalid_occupancy_request", str(error)) from error
