from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PersistedModel(ApiModel):
    id: str
    created_at: datetime
    updated_at: datetime
