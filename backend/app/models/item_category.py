from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, event, select
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.item import Item


class ItemCategory(IdMixin, TimestampMixin, Base):
    __tablename__ = "item_categories"

    name: Mapped[str] = mapped_column(String(120), index=True)
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("item_categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent: Mapped[ItemCategory | None] = relationship(
        remote_side="ItemCategory.id",
        back_populates="children",
    )
    children: Mapped[list[ItemCategory]] = relationship(
        back_populates="parent",
        passive_deletes="all",
    )
    items: Mapped[list[Item]] = relationship(back_populates="category")


@event.listens_for(ItemCategory.parent, "set", retval=True)
def prevent_category_cycles(
    category: ItemCategory,
    parent: ItemCategory | None,
    _previous_parent: ItemCategory | None,
    _initiator: object,
) -> None:
    current = parent
    visited = {id(category)}
    while current is not None:
        identity = id(current)
        if identity in visited:
            raise ValueError("item category hierarchy cannot contain a cycle")
        visited.add(identity)
        current = current.parent
    return parent


@event.listens_for(ItemCategory, "before_delete")
def prevent_deleting_category_with_children(
    _mapper: object,
    connection: object,
    category: ItemCategory,
) -> None:
    child_exists = connection.execute(
        select(ItemCategory.id).where(ItemCategory.parent_id == category.id).limit(1)
    ).first()
    if child_exists is not None:
        raise ValueError("item category with children cannot be deleted; deactivate it instead")
