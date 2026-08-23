from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, event, select
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base
from app.models.color import validate_optional_color
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.entity import Entity


class EntityCategory(IdMixin, TimestampMixin, Base):
    __tablename__ = "entity_categories"

    name: Mapped[str] = mapped_column(String(120), index=True)
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("entity_categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent: Mapped[EntityCategory | None] = relationship(
        remote_side="EntityCategory.id",
        back_populates="children",
    )
    children: Mapped[list[EntityCategory]] = relationship(
        back_populates="parent",
        passive_deletes="all",
    )
    entities: Mapped[list[Entity]] = relationship(back_populates="category")

    @validates("color")
    def validate_color(self, _key: str, color: str | None) -> str | None:
        return validate_optional_color(color)


@event.listens_for(EntityCategory.parent, "set", retval=True)
def prevent_category_cycles(
    category: EntityCategory,
    parent: EntityCategory | None,
    _previous_parent: EntityCategory | None,
    _initiator: object,
) -> EntityCategory | None:
    current = parent
    visited = {id(category)}
    while current is not None:
        identity = id(current)
        if identity in visited:
            raise ValueError("entity category hierarchy cannot contain a cycle")
        visited.add(identity)
        current = current.parent
    return parent


@event.listens_for(EntityCategory, "before_delete")
def prevent_deleting_category_with_children(
    _mapper: object,
    connection: object,
    category: EntityCategory,
) -> None:
    child_exists = connection.execute(
        select(EntityCategory.id).where(EntityCategory.parent_id == category.id).limit(1)
    ).first()
    if child_exists is not None:
        raise ValueError("entity category with children cannot be deleted; deactivate it instead")
