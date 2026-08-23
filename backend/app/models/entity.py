from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base
from app.models.color import validate_optional_color
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.booking import BookingParticipant
    from app.models.entity_category import EntityCategory


class FieldDataType(StrEnum):
    TEXT = "text"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    SELECT = "select"


class EntityType(IdMixin, TimestampMixin, Base):
    __tablename__ = "entity_types"

    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    entities: Mapped[list[Entity]] = relationship(back_populates="entity_type")
    field_definitions: Mapped[list[FieldDefinition]] = relationship(
        back_populates="entity_type",
        order_by="FieldDefinition.display_order",
    )
    role_definitions: Mapped[list[RoleDefinition]] = relationship(back_populates="entity_type")

    @validates("color")
    def validate_color(self, _key: str, color: str | None) -> str | None:
        return validate_optional_color(color)


class Entity(IdMixin, TimestampMixin, Base):
    __tablename__ = "entities"

    name: Mapped[str] = mapped_column(String(160), index=True)
    entity_type_id: Mapped[str] = mapped_column(
        ForeignKey("entity_types.id", ondelete="RESTRICT"),
        index=True,
    )
    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("entity_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    entity_type: Mapped[EntityType] = relationship(back_populates="entities")
    category: Mapped[EntityCategory | None] = relationship(back_populates="entities")
    field_values: Mapped[list[EntityFieldValue]] = relationship(
        back_populates="entity",
        cascade="all, delete-orphan",
    )
    booking_participants: Mapped[list[BookingParticipant]] = relationship(back_populates="entity")

    @validates("color")
    def validate_color(self, _key: str, color: str | None) -> str | None:
        return validate_optional_color(color)


class FieldDefinition(IdMixin, TimestampMixin, Base):
    __tablename__ = "field_definitions"
    __table_args__ = (
        UniqueConstraint("entity_type_id", "key", name="uq_field_definitions_type_key"),
        CheckConstraint(
            "data_type IN ('text', 'number', 'boolean', 'date', 'select')",
            name="field_data_type",
        ),
    )

    entity_type_id: Mapped[str] = mapped_column(
        ForeignKey("entity_types.id", ondelete="RESTRICT"),
        index=True,
    )
    key: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(120))
    data_type: Mapped[FieldDataType] = mapped_column(
        Enum(
            FieldDataType,
            values_callable=lambda types: [data_type.value for data_type in types],
            native_enum=False,
            create_constraint=False,
            validate_strings=True,
            name="field_data_type",
        )
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_searchable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_filterable: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    select_options: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    entity_type: Mapped[EntityType] = relationship(back_populates="field_definitions")
    values: Mapped[list[EntityFieldValue]] = relationship(back_populates="field_definition")


class EntityFieldValue(IdMixin, TimestampMixin, Base):
    __tablename__ = "entity_field_values"
    __table_args__ = (
        UniqueConstraint("entity_id", "field_definition_id", name="uq_entity_field_value"),
    )

    entity_id: Mapped[str] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE"),
        index=True,
    )
    field_definition_id: Mapped[str] = mapped_column(
        ForeignKey("field_definitions.id", ondelete="RESTRICT"),
        index=True,
    )
    text_value: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    number_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True, index=True)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True, index=True)
    date_value: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    entity: Mapped[Entity] = relationship(back_populates="field_values")
    field_definition: Mapped[FieldDefinition] = relationship(back_populates="values")

    @property
    def value(self) -> Any:
        if self.field_definition.data_type in {FieldDataType.TEXT, FieldDataType.SELECT}:
            return self.text_value
        if self.field_definition.data_type is FieldDataType.NUMBER:
            return self.number_value
        if self.field_definition.data_type is FieldDataType.BOOLEAN:
            return self.boolean_value
        return self.date_value


class RoleDefinition(IdMixin, TimestampMixin, Base):
    __tablename__ = "role_definitions"

    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120))
    entity_type_id: Mapped[str] = mapped_column(
        ForeignKey("entity_types.id", ondelete="RESTRICT"),
        index=True,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_multiple: Mapped[bool] = mapped_column(Boolean, default=False)
    is_exclusive: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    entity_type: Mapped[EntityType] = relationship(back_populates="role_definitions")
    booking_participants: Mapped[list[BookingParticipant]] = relationship(
        back_populates="role_definition"
    )
