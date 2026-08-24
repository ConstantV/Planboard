from datetime import datetime

from pydantic import Field, model_validator

from app.models.booking import BookingStatus
from app.models.booking_type import DurationMode
from app.schemas.common import ApiModel, PersistedModel
from app.schemas.entity import KEY_PATTERN


class BookingTypeBase(ApiModel):
    key: str = Field(pattern=KEY_PATTERN, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    booking_scope: str = Field(default="default", pattern=KEY_PATTERN, max_length=80)
    default_duration_minutes: int | None = Field(default=None, gt=0, le=10080)
    duration_mode: DurationMode = DurationMode.SUGGESTED

    @model_validator(mode="after")
    def fixed_mode_requires_duration(self) -> "BookingTypeBase":
        if self.duration_mode is DurationMode.FIXED and self.default_duration_minutes is None:
            raise ValueError("fixed duration mode requires default_duration_minutes")
        return self


class BookingTypeCreate(BookingTypeBase):
    pass


class BookingTypeUpdate(ApiModel):
    key: str | None = Field(default=None, pattern=KEY_PATTERN, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    booking_scope: str | None = Field(default=None, pattern=KEY_PATTERN, max_length=80)
    default_duration_minutes: int | None = Field(default=None, gt=0, le=10080)
    duration_mode: DurationMode | None = None


class BookingTypeRead(BookingTypeBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


def validate_aware_interval(start_at: datetime, end_at: datetime) -> None:
    if any(value.tzinfo is None or value.utcoffset() is None for value in (start_at, end_at)):
        raise ValueError("start_at and end_at must include a timezone")
    if end_at <= start_at:
        raise ValueError("end_at must be later than start_at")


class BookingParticipantCreate(ApiModel):
    entity_id: str
    role_definition_id: str
    display_order: int = 0


class BookingParticipantRead(BookingParticipantCreate, PersistedModel):
    entity_name: str
    entity_type_id: str
    entity_type_key: str
    role_key: str
    role_label: str
    booking_scope: str
    is_exclusive: bool
    resolved_color: str


class BookingCreate(ApiModel):
    participants: list[BookingParticipantCreate] = Field(min_length=1)
    start_at: datetime
    end_at: datetime
    status: BookingStatus = BookingStatus.CONFIRMED
    notes: str | None = Field(default=None, max_length=10000)
    booking_type_id: str | None = None

    @model_validator(mode="after")
    def end_must_follow_start(self) -> "BookingCreate":
        validate_aware_interval(self.start_at, self.end_at)
        return self


class BookingUpdate(ApiModel):
    participants: list[BookingParticipantCreate] | None = Field(default=None, min_length=1)
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: BookingStatus | None = None
    notes: str | None = Field(default=None, max_length=10000)
    booking_type_id: str | None = None

    @model_validator(mode="after")
    def timestamps_must_be_aware(self) -> "BookingUpdate":
        for value in (self.start_at, self.end_at):
            if value is not None and (value.tzinfo is None or value.utcoffset() is None):
                raise ValueError("start_at and end_at must include a timezone")
        if self.start_at is not None and self.end_at is not None:
            validate_aware_interval(self.start_at, self.end_at)
        return self


class BookingSlotUpdate(ApiModel):
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def end_must_follow_start(self) -> "BookingSlotUpdate":
        validate_aware_interval(self.start_at, self.end_at)
        return self


class BookingRead(ApiModel):
    id: str
    participants: list[BookingParticipantRead]
    start_at: datetime
    end_at: datetime
    status: BookingStatus
    notes: str | None
    booking_type: BookingTypeRead | None
    created_at: datetime
    updated_at: datetime


class BookingConflict(ApiModel):
    booking_id: str
    entity_id: str
    entity_name: str
    requested_role_id: str
    requested_role_key: str
    conflicting_role_id: str
    conflicting_role_key: str
    start_at: datetime
    end_at: datetime
