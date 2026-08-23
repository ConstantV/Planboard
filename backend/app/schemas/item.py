from app.schemas.common import ApiModel, PersistedModel


class ItemCreate(ApiModel):
    name: str
    item_type: str = "resource"
    is_active: bool = True
    category_id: str | None = None


class ItemRead(ItemCreate, PersistedModel):
    pass
