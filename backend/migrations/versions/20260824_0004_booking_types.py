"""Add configurable BookingTypes with duration rules."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260824_0004"
down_revision: str | None = "20260823_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "booking_types",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("booking_scope", sa.String(length=80), nullable=False),
        sa.Column("default_duration_minutes", sa.Integer(), nullable=True),
        sa.Column(
            "duration_mode",
            sa.Enum(
                "suggested",
                "fixed",
                name="duration_mode",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "default_duration_minutes IS NULL OR default_duration_minutes > 0",
            name="ck_booking_types_positive_duration",
        ),
        sa.CheckConstraint(
            "duration_mode IN ('suggested', 'fixed')",
            name="duration_mode",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_scope", "key", name="uq_booking_types_scope_key"),
    )
    op.create_index("ix_booking_types_key", "booking_types", ["key"])
    op.create_index("ix_booking_types_booking_scope", "booking_types", ["booking_scope"])

    with op.batch_alter_table("bookings") as batch_op:
        batch_op.add_column(
            sa.Column("booking_type_id", sa.String(length=36), nullable=True)
        )
        batch_op.create_index("ix_bookings_booking_type_id", ["booking_type_id"])
        batch_op.create_foreign_key(
            "fk_bookings_booking_type_id",
            "booking_types",
            ["booking_type_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("bookings") as batch_op:
        batch_op.drop_constraint("fk_bookings_booking_type_id", type_="foreignkey")
        batch_op.drop_index("ix_bookings_booking_type_id")
        batch_op.drop_column("booking_type_id")

    op.drop_index("ix_booking_types_booking_scope", table_name="booking_types")
    op.drop_index("ix_booking_types_key", table_name="booking_types")
    op.drop_table("booking_types")
