from datetime import datetime
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models import FieldDataType
from app.schemas.common import ApiModel

KEY_PATTERN = r"^[a-z][a-z0-9_]*$"
COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class FieldDefinitionBase(ApiModel):
    key: str = Field(pattern=KEY_PATTERN, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    data_type: FieldDataType
    is_required: bool = False
    is_searchable: bool = False
    is_filterable: bool = False
    display_order: int = 0
    select_options: list[str] | None = None

    @model_validator(mode="after")
    def validate_options(self) -> "FieldDefinitionBase":
        if self.data_type is FieldDataType.SELECT:
            if not self.select_options or any(not option.strip() for option in self.select_options):
                raise ValueError("select fields require non-empty options")
            if len(set(self.select_options)) != len(self.select_options):
                raise ValueError("select field options must be unique")
        elif self.select_options is not None:
            raise ValueError("select_options are only valid for select fields")
        return self


class FieldDefinitionCreate(FieldDefinitionBase):
    pass


class FieldDefinitionUpdate(ApiModel):
    key: str | None = Field(default=None, pattern=KEY_PATTERN, max_length=80)
    label: str | None = Field(default=None, min_length=1, max_length=120)
    data_type: FieldDataType | None = None
    is_required: bool | None = None
    is_searchable: bool | None = None
    is_filterable: bool | None = None
    display_order: int | None = None
    select_options: list[str] | None = None


class FieldDefinitionRead(FieldDefinitionBase):
    id: str
    entity_type_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RoleDefinitionBase(ApiModel):
    key: str = Field(pattern=KEY_PATTERN, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    booking_scope: str = Field(default="default", pattern=KEY_PATTERN, max_length=80)
    entity_type_id: str
    is_required: bool = False
    allow_multiple: bool = False
    is_exclusive: bool = True
    display_order: int = 0


class RoleDefinitionCreate(RoleDefinitionBase):
    pass


class RoleDefinitionUpdate(ApiModel):
    key: str | None = Field(default=None, pattern=KEY_PATTERN, max_length=80)
    label: str | None = Field(default=None, min_length=1, max_length=120)
    booking_scope: str | None = Field(default=None, pattern=KEY_PATTERN, max_length=80)
    entity_type_id: str | None = None
    is_required: bool | None = None
    allow_multiple: bool | None = None
    is_exclusive: bool | None = None
    display_order: int | None = None


class RoleDefinitionRead(RoleDefinitionBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EntityTypeBase(ApiModel):
    key: str = Field(pattern=KEY_PATTERN, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)


class EntityTypeCreate(EntityTypeBase):
    fields: list[FieldDefinitionCreate] = Field(default_factory=list)


class EntityTypeUpdate(ApiModel):
    key: str | None = Field(default=None, pattern=KEY_PATTERN, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)


class EntityTypeRead(EntityTypeBase):
    id: str
    is_active: bool
    fields: list[FieldDefinitionRead]
    roles: list[RoleDefinitionRead]
    created_at: datetime
    updated_at: datetime


class EntityCategoryBase(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    parent_id: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)


class EntityCategoryCreate(EntityCategoryBase):
    pass


class EntityCategoryUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_id: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)


class EntityCategoryRead(EntityCategoryBase):
    id: str
    is_active: bool
    path: list[str]
    created_at: datetime
    updated_at: datetime


class EntityCreate(ApiModel):
    name: str = Field(min_length=1, max_length=160)
    entity_type_id: str
    category_id: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    values: dict[str, Any] = Field(default_factory=dict)

    @field_validator("values")
    @classmethod
    def values_must_use_valid_keys(cls, values: dict[str, Any]) -> dict[str, Any]:
        if any(not key or not key.replace("_", "a").isalnum() for key in values):
            raise ValueError("custom value keys must use letters, numbers, and underscores")
        return values


class EntityUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    entity_type_id: str | None = None
    category_id: str | None = None
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)
    values: dict[str, Any] | None = None


class EntityRead(ApiModel):
    id: str
    name: str
    entity_type_id: str
    entity_type_key: str
    entity_type_name: str
    category_id: str | None
    category_path: list[str]
    color: str | None
    resolved_color: str
    is_active: bool
    values: dict[str, Any]
    created_at: datetime
    updated_at: datetime
