from app.schemas.common import ApiModel, PersistedModel


class ClientCreate(ApiModel):
    name: str
    email: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_archived: bool = False


class ClientRead(ClientCreate, PersistedModel):
    pass
