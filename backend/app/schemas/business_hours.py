from datetime import time

from pydantic import Field, field_validator, model_validator

from app.schemas.common import ApiModel, PersistedModel


class BusinessHoursBase(ApiModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    end_time: str = Field(pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    is_closed: bool = False

    @field_validator("start_time", "end_time")
    @classmethod
    def time_must_be_valid(cls, value: str) -> str:
        hour, minute = value.split(":")
        time(hour=int(hour), minute=int(minute))
        return value

    @model_validator(mode="after")
    def end_must_follow_start(self) -> "BusinessHoursBase":
        if not self.is_closed:
            start = self._parse_time(self.start_time)
            end = self._parse_time(self.end_time)
            if end <= start:
                raise ValueError("end_time must be later than start_time")
        return self

    @staticmethod
    def _parse_time(value: str) -> time:
        hour, minute = value.split(":")
        return time(hour=int(hour), minute=int(minute))


class BusinessHoursCreate(BusinessHoursBase):
    pass


class BusinessHoursUpdate(ApiModel):
    start_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    end_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    is_closed: bool | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def time_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        hour, minute = value.split(":")
        time(hour=int(hour), minute=int(minute))
        return value


class BusinessHoursRead(BusinessHoursBase, PersistedModel):
    pass


class BusinessHoursBulkUpdate(ApiModel):
    hours: list[BusinessHoursCreate] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def all_days_present(self) -> "BusinessHoursBulkUpdate":
        days = {item.day_of_week for item in self.hours}
        if days != set(range(7)):
            raise ValueError("hours must contain exactly one entry for each day of the week")
        return self
