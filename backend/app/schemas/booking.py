from datetime import datetime

from pydantic import model_validator

from app.models.booking import BookingStatus
from app.schemas.common import ApiModel, PersistedModel


class BookingCreate(ApiModel):
    item_id: str
    client_id: str
    start_at: datetime
    end_at: datetime
    status: BookingStatus = BookingStatus.CONFIRMED
    notes: str | None = None

    @model_validator(mode="after")
    def end_must_follow_start(self) -> "BookingCreate":
        if any(
            value.tzinfo is None or value.utcoffset() is None
            for value in (self.start_at, self.end_at)
        ):
            raise ValueError("start_at and end_at must include a timezone")
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be later than start_at")
        return self


class BookingRead(BookingCreate, PersistedModel):
    pass
