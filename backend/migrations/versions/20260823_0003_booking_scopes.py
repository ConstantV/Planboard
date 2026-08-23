"""Scope required planning roles to one Booking configuration."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260823_0003"
down_revision: str | None = "20260823_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("role_definitions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "booking_scope",
                sa.String(length=80),
                server_default="default",
                nullable=False,
            )
        )
        batch_op.create_index("ix_role_definitions_booking_scope", ["booking_scope"])

    scope_roles = {
        "legacy": ("client", "resource"),
        "hair_salon": ("salon_customer", "hairdresser", "salon_station"),
        "rental": ("rental_customer", "rental_item", "rental_staff"),
        "repair_workshop": ("workpiece", "mechanic", "workbench"),
    }
    bind = op.get_bind()
    for scope, role_keys in scope_roles.items():
        placeholders = ", ".join(f":role_{index}" for index in range(len(role_keys)))
        parameters = {f"role_{index}": key for index, key in enumerate(role_keys)}
        parameters["scope"] = scope
        bind.execute(
            sa.text(
                f"UPDATE role_definitions SET booking_scope = :scope WHERE key IN ({placeholders})"
            ),
            parameters,
        )


def downgrade() -> None:
    with op.batch_alter_table("role_definitions") as batch_op:
        batch_op.drop_index("ix_role_definitions_booking_scope")
        batch_op.drop_column("booking_scope")
