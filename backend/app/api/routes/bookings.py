from datetime import datetime

from fastapi import APIRouter, Query, Response
from fastapi import status as http_status
from sqlalchemy.orm import Session

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.api.routes.categories import load_category
from app.api.routes.configuration import load_entity_type
from app.api.routes.entities import load_entity
from app.api.routes.helpers import parse_field_filters
from app.models import Booking, BookingParticipant, BookingStatus, BookingType, RoleDefinition
from app.schemas.booking import BookingCreate, BookingRead, BookingUpdate
from app.services.booking_service import (
    BookingValidationError,
    begin_booking_write,
    booking_statement,
    find_booking_conflicts,
    list_bookings,
    participant_scope,
    replace_participants,
    resolve_participants,
    serialize_booking,
    validate_booking_type,
    validate_interval,
)
from app.services.entity_service import EntityConfigurationError

router = APIRouter()


def load_booking(session: Session, booking_id: str) -> Booking:
    booking = session.scalar(booking_statement().where(Booking.id == booking_id))
    if booking is None:
        raise ApiError(404, "booking_not_found", "Booking does not exist")
    return booking


def load_booking_type(session: Session, booking_type_id: str) -> BookingType:
    booking_type = session.get(BookingType, booking_type_id)
    if booking_type is None:
        raise ApiError(404, "booking_type_not_found", "BookingType does not exist")
    return booking_type


def raise_conflict(conflicts: list[dict]) -> None:
    if conflicts:
        raise ApiError(
            409,
            "booking_conflict",
            "One or more exclusive Entities are already booked",
            conflicts,
        )


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings_route(
    session: DbSession,
    range_start: datetime | None = None,
    range_end: datetime | None = None,
    entity_type_id: str | None = None,
    entity_id: str | None = None,
    role_definition_id: str | None = None,
    category_id: str | None = None,
    status: BookingStatus | None = None,
    search: str | None = Query(default=None, max_length=160),
    filters: str | None = Query(default=None, description='JSON object, e.g. {"brand":"Ford"}'),
) -> list[dict]:
    try:
        if range_start is not None and range_end is not None:
            validate_interval(range_start, range_end)
        else:
            for value in (range_start, range_end):
                if value is not None and (value.tzinfo is None or value.utcoffset() is None):
                    raise BookingValidationError("range timestamps must include a timezone")
        if entity_type_id is not None:
            load_entity_type(session, entity_type_id)
        if entity_id is not None:
            load_entity(session, entity_id)
        if (
            role_definition_id is not None
            and session.get(RoleDefinition, role_definition_id) is None
        ):
            raise ApiError(404, "role_definition_not_found", "RoleDefinition does not exist")
        if category_id is not None:
            load_category(session, category_id)
        bookings = list_bookings(
            session,
            range_start=range_start,
            range_end=range_end,
            entity_type_id=entity_type_id,
            entity_id=entity_id,
            role_definition_id=role_definition_id,
            category_id=category_id,
            status=status,
            search_query=search,
            field_filters=parse_field_filters(filters),
        )
    except (BookingValidationError, EntityConfigurationError) as error:
        raise ApiError(422, "invalid_booking_filter", str(error)) from error
    return [serialize_booking(booking) for booking in bookings]


@router.post(
    "/bookings",
    response_model=BookingRead,
    status_code=http_status.HTTP_201_CREATED,
)
def create_booking(payload: BookingCreate, session: DbSession) -> dict:
    try:
        begin_booking_write(session)
        participants = resolve_participants(session, payload.participants)
        booking_type = (
            load_booking_type(session, payload.booking_type_id)
            if payload.booking_type_id is not None
            else None
        )
        if booking_type is not None:
            validate_booking_type(
                booking_type,
                scope=participant_scope(participants),
                start_at=payload.start_at,
                end_at=payload.end_at,
            )
        if payload.status is not BookingStatus.CANCELLED:
            raise_conflict(
                find_booking_conflicts(
                    session,
                    participants=participants,
                    start_at=payload.start_at,
                    end_at=payload.end_at,
                )
            )
        booking = Booking(
            start_at=payload.start_at,
            end_at=payload.end_at,
            status=payload.status,
            notes=payload.notes,
            booking_type=booking_type,
            participants=[
                BookingParticipant(
                    entity=participant.entity,
                    role_definition=participant.role,
                    display_order=participant.display_order,
                )
                for participant in participants
            ],
        )
        session.add(booking)
        session.commit()
    except BookingValidationError as error:
        session.rollback()
        raise ApiError(422, "invalid_booking", str(error)) from error
    return serialize_booking(load_booking(session, booking.id))


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: str, session: DbSession) -> dict:
    return serialize_booking(load_booking(session, booking_id))


@router.patch("/bookings/{booking_id}", response_model=BookingRead)
def update_booking(
    booking_id: str,
    payload: BookingUpdate,
    session: DbSession,
) -> dict:
    begin_booking_write(session)
    booking = load_booking(session, booking_id)
    changes = payload.model_dump(exclude_unset=True)
    participant_payloads = changes.pop("participants", None)
    booking_type_changed = "booking_type_id" in changes
    booking_type_id = changes.pop("booking_type_id", None)
    start_at = changes.get("start_at", booking.start_at)
    end_at = changes.get("end_at", booking.end_at)
    target_status = changes.get("status", booking.status)
    interval_changed = start_at != booking.start_at or end_at != booking.end_at
    try:
        validate_interval(start_at, end_at)
        if participant_payloads is not None:
            participants = resolve_participants(session, payload.participants or [])
        else:
            participants = resolve_participants(session, booking.participants)
        if booking_type_changed:
            target_booking_type = (
                load_booking_type(session, booking_type_id)
                if booking_type_id is not None
                else None
            )
        else:
            target_booking_type = booking.booking_type
        if target_booking_type is not None and (
            booking_type_changed or participant_payloads is not None or interval_changed
        ):
            validate_booking_type(
                target_booking_type,
                scope=participant_scope(participants),
                start_at=start_at,
                end_at=end_at,
            )
        if target_status is not BookingStatus.CANCELLED:
            raise_conflict(
                find_booking_conflicts(
                    session,
                    participants=participants,
                    start_at=start_at,
                    end_at=end_at,
                    exclude_booking_id=booking.id,
                )
            )
        for key, value in changes.items():
            setattr(booking, key, value)
        if booking_type_changed:
            booking.booking_type = target_booking_type
        if participant_payloads is not None:
            replace_participants(session, booking, participants)
        session.commit()
    except BookingValidationError as error:
        session.rollback()
        raise ApiError(422, "invalid_booking", str(error)) from error
    return serialize_booking(load_booking(session, booking.id))


@router.post("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(booking_id: str, session: DbSession) -> dict:
    begin_booking_write(session)
    booking = load_booking(session, booking_id)
    booking.status = BookingStatus.CANCELLED
    session.commit()
    return serialize_booking(load_booking(session, booking.id))


@router.delete("/bookings/{booking_id}", status_code=http_status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: str, session: DbSession) -> Response:
    begin_booking_write(session)
    booking = load_booking(session, booking_id)
    if booking.status is not BookingStatus.CANCELLED:
        raise ApiError(
            409,
            "booking_must_be_cancelled",
            "Only cancelled Bookings can be deleted",
        )
    session.delete(booking)
    session.commit()
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)
