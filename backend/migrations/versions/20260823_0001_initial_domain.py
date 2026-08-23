"""Create the initial Planboard domain schema."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260823_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    table_names = set(inspector.get_table_names())
    legacy_tables = {"bookings", "clients", "items"}

    if legacy_tables.issubset(table_names) and "is_archived" not in {
        column["name"] for column in inspector.get_columns("clients")
    }:
        upgrade_legacy_schema(table_names, inspector)
        return

    create_schema()


def upgrade_legacy_schema(table_names: set[str], inspector: sa.Inspector) -> None:
    if "item_categories" in table_names:
        category_count = (
            op.get_bind().execute(sa.text("SELECT COUNT(*) FROM item_categories")).scalar_one()
        )
        if category_count:
            raise RuntimeError("cannot reconcile a non-empty pre-migration item_categories table")
        op.drop_table("item_categories")

    legacy_indexes = {
        table_name: inspector.get_indexes(table_name)
        for table_name in ("bookings", "items", "clients")
    }
    for table_name in ("bookings", "items", "clients"):
        op.rename_table(table_name, f"_legacy_{table_name}")
        for index in legacy_indexes[table_name]:
            if index["name"]:
                op.drop_index(index["name"], table_name=f"_legacy_{table_name}")

    create_schema()

    op.execute(
        sa.text(
            """
            INSERT INTO clients (name, email, phone, notes, is_archived, id, created_at, updated_at)
            SELECT name, email, phone, notes, 0, id, created_at, updated_at
            FROM _legacy_clients
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO items (
                name, item_type, is_active, category_id, id, created_at, updated_at
            )
            SELECT name, item_type, is_active, NULL, id, created_at, updated_at
            FROM _legacy_items
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO bookings (
                item_id, client_id, start_at, end_at, status, notes, id, created_at, updated_at
            )
            SELECT item_id, client_id, start_at, end_at, status, notes, id, created_at, updated_at
            FROM _legacy_bookings
            """
        )
    )

    op.drop_table("_legacy_bookings")
    op.drop_table("_legacy_items")
    op.drop_table("_legacy_clients")


def create_schema() -> None:
    op.create_table(
        "item_categories",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("parent_id", sa.String(length=36), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["parent_id"], ["item_categories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_item_categories_name", "item_categories", ["name"])
    op.create_index("ix_item_categories_parent_id", "item_categories", ["parent_id"])

    op.create_table(
        "clients",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clients_name", "clients", ["name"])

    op.create_table(
        "items",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("item_type", sa.String(length=80), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["category_id"], ["item_categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_category_id", "items", ["category_id"])
    op.create_index("ix_items_name", "items", ["name"])

    op.create_table(
        "bookings",
        sa.Column("item_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "confirmed",
                "tentative",
                "cancelled",
                name="booking_status",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.CheckConstraint(
            "status IN ('confirmed', 'tentative', 'cancelled')",
            name="booking_status",
        ),
        sa.CheckConstraint("end_at > start_at", name="ck_bookings_valid_interval"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bookings_client_id", "bookings", ["client_id"])
    op.create_index("ix_bookings_end_at", "bookings", ["end_at"])
    op.create_index("ix_bookings_item_id", "bookings", ["item_id"])
    op.create_index("ix_bookings_start_at", "bookings", ["start_at"])


def downgrade() -> None:
    op.drop_table("bookings")
    op.drop_table("items")
    op.drop_table("clients")
    op.drop_table("item_categories")
