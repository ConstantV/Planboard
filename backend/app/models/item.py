from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.item_category import ItemCategory


class Item(IdMixin, TimestampMixin, Base):
    __tablename__ = "items"

    name: Mapped[str] = mapped_column(String(120), index=True)
    item_type: Mapped[str] = mapped_column(String(80), default="resource")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("item_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    bookings: Mapped[list[Booking]] = relationship(back_populates="item")
    category: Mapped[ItemCategory | None] = relationship(back_populates="items")
