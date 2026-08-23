from datetime import datetime

from pydantic import model_validator

from app.schemas.common import ApiModel, PersistedModel


class BookingCreate(ApiModel):
    item_id: str
    client_id: str
    start_at: datetime
    end_at: datetime
    status: str = "confirmed"
    notes: str | None = None

    @model_validator(mode="after")
    def end_must_follow_start(self) -> "BookingCreate":
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be later than start_at")
        return self


class BookingRead(BookingCreate, PersistedModel):
    pass
