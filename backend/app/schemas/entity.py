from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models import FieldDataType
from app.schemas.common import ApiModel, PersistedModel


class FieldDefinitionCreate(ApiModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=80)
    label: str = Field(min_length=1, max_length=120)
    data_type: FieldDataType
    is_required: bool = False
    is_searchable: bool = False
    is_filterable: bool = False
    display_order: int = 0
    select_options: list[str] | None = None

    @model_validator(mode="after")
    def validate_options(self) -> "FieldDefinitionCreate":
        if self.data_type is FieldDataType.SELECT:
            if not self.select_options or any(not option.strip() for option in self.select_options):
                raise ValueError("select fields require non-empty options")
            if len(set(self.select_options)) != len(self.select_options):
                raise ValueError("select field options must be unique")
        elif self.select_options is not None:
            raise ValueError("select_options are only valid for select fields")
        return self


class EntityTypeCreate(ApiModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=80)
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    fields: list[FieldDefinitionCreate] = Field(default_factory=list)


class RoleDefinitionCreate(ApiModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=80)
    label: str = Field(min_length=1, max_length=120)
    entity_type_id: str
    is_required: bool = False
    allow_multiple: bool = False
    is_exclusive: bool = True
    display_order: int = 0


CustomValue = str | Decimal | bool | date


class EntityCreate(ApiModel):
    name: str = Field(min_length=1, max_length=160)
    entity_type_id: str
    category_id: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    values: dict[str, Any] = Field(default_factory=dict)

    @field_validator("values")
    @classmethod
    def values_must_use_valid_keys(cls, values: dict[str, Any]) -> dict[str, Any]:
        if any(not key or not key.replace("_", "a").isalnum() for key in values):
            raise ValueError("custom value keys must use letters, numbers, and underscores")
        return values


class EntityRead(EntityCreate, PersistedModel):
    resolved_color: str
