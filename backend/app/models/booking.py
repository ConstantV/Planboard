from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.item import Item


class Booking(IdMixin, TimestampMixin, Base):
    __tablename__ = "bookings"

    item_id: Mapped[str] = mapped_column(ForeignKey("items.id"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(32), default="confirmed")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    item: Mapped[Item] = relationship(back_populates="bookings")
    client: Mapped[Client] = relationship(back_populates="bookings")
