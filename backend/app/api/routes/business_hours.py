from fastapi import APIRouter

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.schemas.business_hours import BusinessHoursBulkUpdate, BusinessHoursRead
from app.services.business_hours_service import (
    get_business_hours,
    serialize_business_hours,
    set_business_hours,
)

router = APIRouter()


@router.get("/business-hours", response_model=list[BusinessHoursRead])
def list_business_hours(session: DbSession) -> list[dict]:
    hours = get_business_hours(session)
    return [serialize_business_hours(hours[day]) for day in sorted(hours)]


@router.put("/business-hours", response_model=list[BusinessHoursRead])
def update_business_hours(payload: BusinessHoursBulkUpdate, session: DbSession) -> list[dict]:
    try:
        hours = set_business_hours(session, [item.model_dump() for item in payload.hours])
    except ValueError as error:
        raise ApiError(422, "invalid_business_hours", str(error)) from error
    return [serialize_business_hours(hours[day]) for day in sorted(hours)]
