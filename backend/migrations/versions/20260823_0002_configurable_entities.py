"""Generalize Items and Clients into configurable planning entities."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260823_0002"
down_revision: str | None = "20260823_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CLIENT_TYPE_ID = "00000000-0000-0000-0000-000000000001"
ITEM_TYPE_ID = "00000000-0000-0000-0000-000000000002"
CLIENT_ROLE_ID = "00000000-0000-0000-0000-000000000003"
ITEM_ROLE_ID = "00000000-0000-0000-0000-000000000004"
EMAIL_FIELD_ID = "00000000-0000-0000-0000-000000000005"
PHONE_FIELD_ID = "00000000-0000-0000-0000-000000000006"
NOTES_FIELD_ID = "00000000-0000-0000-0000-000000000007"
ITEM_TYPE_FIELD_ID = "00000000-0000-0000-0000-000000000008"


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    duplicate_id = bind.execute(
        sa.text("SELECT items.id FROM items JOIN clients ON clients.id = items.id LIMIT 1")
    ).first()
    if duplicate_id is not None:
        raise RuntimeError("Item and Client IDs collide and cannot be migrated safely")

    op.drop_index("ix_item_categories_name", table_name="item_categories")
    op.drop_index("ix_item_categories_parent_id", table_name="item_categories")
    op.rename_table("item_categories", "entity_categories")
    with op.batch_alter_table("entity_categories") as batch_op:
        batch_op.add_column(sa.Column("color", sa.String(length=7), nullable=True))
    op.create_index("ix_entity_categories_name", "entity_categories", ["name"])
    op.create_index("ix_entity_categories_parent_id", "entity_categories", ["parent_id"])

    op.create_table(
        "entity_types",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entity_types_key", "entity_types", ["key"], unique=True)

    op.create_table(
        "entities",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("entity_type_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["category_id"], ["entity_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entity_type_id"], ["entity_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entities_category_id", "entities", ["category_id"])
    op.create_index("ix_entities_entity_type_id", "entities", ["entity_type_id"])
    op.create_index("ix_entities_name", "entities", ["name"])

    op.create_table(
        "field_definitions",
        sa.Column("entity_type_id", sa.String(length=36), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column(
            "data_type",
            sa.Enum(
                "text",
                "number",
                "boolean",
                "date",
                "select",
                name="field_data_type",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("is_searchable", sa.Boolean(), nullable=False),
        sa.Column("is_filterable", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("select_options", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.CheckConstraint(
            "data_type IN ('text', 'number', 'boolean', 'date', 'select')",
            name="field_data_type",
        ),
        sa.ForeignKeyConstraint(["entity_type_id"], ["entity_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_type_id", "key", name="uq_field_definitions_type_key"),
    )
    op.create_index("ix_field_definitions_entity_type_id", "field_definitions", ["entity_type_id"])

    op.create_table(
        "role_definitions",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("entity_type_id", sa.String(length=36), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("allow_multiple", sa.Boolean(), nullable=False),
        sa.Column("is_exclusive", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["entity_type_id"], ["entity_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_role_definitions_entity_type_id", "role_definitions", ["entity_type_id"])
    op.create_index("ix_role_definitions_key", "role_definitions", ["key"], unique=True)

    op.create_table(
        "entity_field_values",
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("field_definition_id", sa.String(length=36), nullable=False),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("number_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("date_value", sa.Date(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["entity_id"], ["entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["field_definition_id"], ["field_definitions.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_id", "field_definition_id", name="uq_entity_field_value"),
    )
    for column_name in (
        "boolean_value",
        "date_value",
        "entity_id",
        "field_definition_id",
        "number_value",
        "text_value",
    ):
        op.create_index(
            f"ix_entity_field_values_{column_name}", "entity_field_values", [column_name]
        )

    op.create_table(
        "booking_participants",
        sa.Column("booking_id", sa.String(length=36), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("role_definition_id", sa.String(length=36), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entity_id"], ["entities.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["role_definition_id"], ["role_definitions.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "booking_id", "entity_id", "role_definition_id", name="uq_booking_participant"
        ),
    )
    for column_name in ("booking_id", "entity_id", "role_definition_id"):
        op.create_index(
            f"ix_booking_participants_{column_name}", "booking_participants", [column_name]
        )

    seed_legacy_configuration()
    migrate_legacy_data()
    remove_legacy_booking_columns()
    op.drop_table("items")
    op.drop_table("clients")


def seed_legacy_configuration() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO entity_types (key, name, color, is_active, id)
            VALUES ('client', 'Client', '#64748B', 1, :client_type_id),
                   ('resource', 'Item', '#3788D8', 1, :item_type_id)
            """
        ),
        {"client_type_id": CLIENT_TYPE_ID, "item_type_id": ITEM_TYPE_ID},
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO role_definitions (
                key, label, entity_type_id, is_required, allow_multiple,
                is_exclusive, display_order, is_active, id
            )
            VALUES ('client', 'Client', :client_type_id, 1, 0, 0, 0, 1, :client_role_id),
                   ('resource', 'Item', :item_type_id, 1, 0, 1, 1, 1, :item_role_id)
            """
        ),
        {
            "client_type_id": CLIENT_TYPE_ID,
            "item_type_id": ITEM_TYPE_ID,
            "client_role_id": CLIENT_ROLE_ID,
            "item_role_id": ITEM_ROLE_ID,
        },
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO field_definitions (
                entity_type_id, key, label, data_type, is_required, is_searchable,
                is_filterable, display_order, select_options, is_active, id
            )
            VALUES (:client_type_id, 'email', 'Email', 'text', 0, 1, 0, 0, NULL, 1, :email),
                   (:client_type_id, 'phone', 'Phone', 'text', 0, 1, 0, 1, NULL, 1, :phone),
                   (:client_type_id, 'notes', 'Notes', 'text', 0, 0, 0, 2, NULL, 1, :notes),
                   (:item_type_id, 'item_type', 'Item type', 'text', 1, 0, 1, 0, NULL, 1,
                    :item_type_field)
            """
        ),
        {
            "client_type_id": CLIENT_TYPE_ID,
            "item_type_id": ITEM_TYPE_ID,
            "email": EMAIL_FIELD_ID,
            "phone": PHONE_FIELD_ID,
            "notes": NOTES_FIELD_ID,
            "item_type_field": ITEM_TYPE_FIELD_ID,
        },
    )


def migrate_legacy_data() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO entities (
                name, entity_type_id, category_id, color, is_active, id, created_at, updated_at
            )
            SELECT name, :client_type_id, NULL, NULL, NOT is_archived, id, created_at, updated_at
            FROM clients
            UNION ALL
            SELECT name, :item_type_id, category_id, NULL, is_active, id, created_at, updated_at
            FROM items
            """
        ),
        {"client_type_id": CLIENT_TYPE_ID, "item_type_id": ITEM_TYPE_ID},
    )
    for source_column, field_id in (
        ("email", EMAIL_FIELD_ID),
        ("phone", PHONE_FIELD_ID),
        ("notes", NOTES_FIELD_ID),
    ):
        bind.execute(
            sa.text(
                f"""
                INSERT INTO entity_field_values (
                    entity_id, field_definition_id, text_value, id
                )
                SELECT id, :field_id, {source_column}, lower(hex(randomblob(16)))
                FROM clients WHERE {source_column} IS NOT NULL
                """
            ),
            {"field_id": field_id},
        )
    bind.execute(
        sa.text(
            """
            INSERT INTO entity_field_values (entity_id, field_definition_id, text_value, id)
            SELECT id, :field_id, item_type, lower(hex(randomblob(16))) FROM items
            """
        ),
        {"field_id": ITEM_TYPE_FIELD_ID},
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO booking_participants (
                booking_id, entity_id, role_definition_id, display_order, id
            )
            SELECT id, client_id, :client_role_id, 0, lower(hex(randomblob(16))) FROM bookings
            UNION ALL
            SELECT id, item_id, :item_role_id, 1, lower(hex(randomblob(16))) FROM bookings
            """
        ),
        {"client_role_id": CLIENT_ROLE_ID, "item_role_id": ITEM_ROLE_ID},
    )


def remove_legacy_booking_columns() -> None:
    naming_convention = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}
    with op.batch_alter_table(
        "bookings", recreate="always", naming_convention=naming_convention
    ) as batch_op:
        batch_op.drop_constraint("fk_bookings_client_id_clients", type_="foreignkey")
        batch_op.drop_constraint("fk_bookings_item_id_items", type_="foreignkey")
        batch_op.drop_index("ix_bookings_client_id")
        batch_op.drop_index("ix_bookings_item_id")
        batch_op.drop_column("client_id")
        batch_op.drop_column("item_id")


def downgrade() -> None:
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
        sa.ForeignKeyConstraint(["category_id"], ["entity_categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_category_id", "items", ["category_id"])
    op.create_index("ix_items_name", "items", ["name"])

    restore_legacy_data()
    restore_legacy_booking_columns()

    op.drop_table("booking_participants")
    op.drop_table("entity_field_values")
    op.drop_table("role_definitions")
    op.drop_table("field_definitions")
    op.drop_table("entities")
    op.drop_table("entity_types")

    op.drop_index("ix_entity_categories_name", table_name="entity_categories")
    op.drop_index("ix_entity_categories_parent_id", table_name="entity_categories")
    with op.batch_alter_table("entity_categories") as batch_op:
        batch_op.drop_column("color")
    op.rename_table("entity_categories", "item_categories")
    op.create_index("ix_item_categories_name", "item_categories", ["name"])
    op.create_index("ix_item_categories_parent_id", "item_categories", ["parent_id"])


def restore_legacy_data() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO clients (name, email, phone, notes, is_archived, id, created_at, updated_at)
            SELECT e.name,
                   (SELECT v.text_value FROM entity_field_values v
                    WHERE v.entity_id = e.id AND v.field_definition_id = :email),
                   (SELECT v.text_value FROM entity_field_values v
                    WHERE v.entity_id = e.id AND v.field_definition_id = :phone),
                   (SELECT v.text_value FROM entity_field_values v
                    WHERE v.entity_id = e.id AND v.field_definition_id = :notes),
                   NOT e.is_active, e.id, e.created_at, e.updated_at
            FROM entities e WHERE e.entity_type_id = :client_type_id
            """
        ),
        {
            "email": EMAIL_FIELD_ID,
            "phone": PHONE_FIELD_ID,
            "notes": NOTES_FIELD_ID,
            "client_type_id": CLIENT_TYPE_ID,
        },
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO items (
                name, item_type, is_active, category_id, id, created_at, updated_at
            )
            SELECT e.name, v.text_value, e.is_active, e.category_id,
                   e.id, e.created_at, e.updated_at
            FROM entities e JOIN entity_field_values v ON v.entity_id = e.id
            WHERE e.entity_type_id = :item_type_id
              AND v.field_definition_id = :item_type_field_id
            """
        ),
        {"item_type_id": ITEM_TYPE_ID, "item_type_field_id": ITEM_TYPE_FIELD_ID},
    )


def restore_legacy_booking_columns() -> None:
    with op.batch_alter_table("bookings") as batch_op:
        batch_op.add_column(sa.Column("item_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("client_id", sa.String(length=36), nullable=True))
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE bookings SET
                client_id = (SELECT entity_id FROM booking_participants
                             WHERE booking_id = bookings.id
                               AND role_definition_id = :client_role_id LIMIT 1),
                item_id = (SELECT entity_id FROM booking_participants
                           WHERE booking_id = bookings.id
                             AND role_definition_id = :item_role_id LIMIT 1)
            """
        ),
        {"client_role_id": CLIENT_ROLE_ID, "item_role_id": ITEM_ROLE_ID},
    )
    incompatible = bind.execute(
        sa.text("SELECT id FROM bookings WHERE client_id IS NULL OR item_id IS NULL LIMIT 1")
    ).first()
    if incompatible is not None:
        raise RuntimeError("custom Bookings cannot be represented by the step-2 schema")
    with op.batch_alter_table("bookings", recreate="always") as batch_op:
        batch_op.alter_column("client_id", existing_type=sa.String(36), nullable=False)
        batch_op.alter_column("item_id", existing_type=sa.String(36), nullable=False)
        batch_op.create_foreign_key(
            "fk_bookings_client_id_clients", "clients", ["client_id"], ["id"], ondelete="RESTRICT"
        )
        batch_op.create_foreign_key(
            "fk_bookings_item_id_items", "items", ["item_id"], ["id"], ondelete="RESTRICT"
        )
        batch_op.create_index("ix_bookings_client_id", ["client_id"])
        batch_op.create_index("ix_bookings_item_id", ["item_id"])
