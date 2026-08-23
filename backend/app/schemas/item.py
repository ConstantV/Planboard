from app.schemas.common import ApiModel, PersistedModel


class ItemCreate(ApiModel):
    name: str
    item_type: str = "resource"
    is_active: bool = True


class ItemRead(ItemCreate, PersistedModel):
    pass
