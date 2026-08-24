from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.api.routes.helpers import commit_or_conflict
from app.models import BookingType, DurationMode
from app.schemas.booking import BookingTypeCreate, BookingTypeRead, BookingTypeUpdate
from app.services.management_service import serialize_booking_type

router = APIRouter()


def load_booking_type(session: Session, booking_type_id: str) -> BookingType:
    booking_type = session.get(BookingType, booking_type_id)
    if booking_type is None:
        raise ApiError(404, "booking_type_not_found", "BookingType does not exist")
    return booking_type


def enforce_fixed_duration(booking_type: BookingType) -> None:
    if (
        booking_type.duration_mode is DurationMode.FIXED
        and booking_type.default_duration_minutes is None
    ):
        raise ApiError(
            422,
            "invalid_booking_type",
            "fixed duration mode requires default_duration_minutes",
        )


@router.get("/booking-types", response_model=list[BookingTypeRead])
def list_booking_types(
    session: DbSession,
    booking_scope: str | None = None,
    include_inactive: bool = False,
) -> list[dict]:
    statement = select(BookingType).order_by(BookingType.booking_scope, BookingType.name)
    if booking_scope is not None:
        statement = statement.where(BookingType.booking_scope == booking_scope)
    if not include_inactive:
        statement = statement.where(BookingType.is_active.is_(True))
    return [serialize_booking_type(booking_type) for booking_type in session.scalars(statement)]


@router.post(
    "/booking-types",
    response_model=BookingTypeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_booking_type(payload: BookingTypeCreate, session: DbSession) -> dict:
    booking_type = BookingType(**payload.model_dump())
    session.add(booking_type)
    commit_or_conflict(session, "BookingType key already exists for this booking_scope")
    return serialize_booking_type(booking_type)


@router.get("/booking-types/{booking_type_id}", response_model=BookingTypeRead)
def get_booking_type(booking_type_id: str, session: DbSession) -> dict:
    return serialize_booking_type(load_booking_type(session, booking_type_id))


@router.patch("/booking-types/{booking_type_id}", response_model=BookingTypeRead)
def update_booking_type(
    booking_type_id: str,
    payload: BookingTypeUpdate,
    session: DbSession,
) -> dict:
    booking_type = load_booking_type(session, booking_type_id)
    changes = payload.model_dump(exclude_unset=True)
    identity_changes = ("key" in changes and changes["key"] != booking_type.key) or (
        "booking_scope" in changes and changes["booking_scope"] != booking_type.booking_scope
    )
    if identity_changes and booking_type.bookings:
        raise ApiError(
            422,
            "booking_type_in_use",
            "Cannot change key or booking_scope while the BookingType is used by Bookings",
        )
    for key, value in changes.items():
        setattr(booking_type, key, value)
    enforce_fixed_duration(booking_type)
    commit_or_conflict(session, "BookingType key already exists for this booking_scope")
    return serialize_booking_type(booking_type)


@router.post("/booking-types/{booking_type_id}/deactivate", response_model=BookingTypeRead)
def deactivate_booking_type(booking_type_id: str, session: DbSession) -> dict:
    booking_type = load_booking_type(session, booking_type_id)
    booking_type.is_active = False
    session.commit()
    return serialize_booking_type(booking_type)
