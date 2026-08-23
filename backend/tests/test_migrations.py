from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

EXPECTED_TABLES = {
    "alembic_version",
    "bookings",
    "clients",
    "item_categories",
    "items",
}


def migration_config(database_url: str) -> Config:
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def table_names(database_url: str) -> set[str]:
    engine = create_engine(database_url)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_blank_database_can_upgrade_downgrade_and_upgrade_again(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'migration-test.db'}"
    config = migration_config(database_url)

    command.upgrade(config, "head")
    assert table_names(database_url) == EXPECTED_TABLES

    command.downgrade(config, "base")
    assert table_names(database_url) == {"alembic_version"}

    command.upgrade(config, "head")
    assert table_names(database_url) == EXPECTED_TABLES


def test_migration_contains_expected_constraints(test_engine) -> None:
    inspector = inspect(test_engine)

    booking_checks = {
        constraint["name"] for constraint in inspector.get_check_constraints("bookings")
    }
    booking_foreign_keys = inspector.get_foreign_keys("bookings")
    category_foreign_keys = inspector.get_foreign_keys("item_categories")
    item_foreign_keys = inspector.get_foreign_keys("items")

    assert "ck_bookings_valid_interval" in booking_checks
    assert {foreign_key["options"].get("ondelete") for foreign_key in booking_foreign_keys} == {
        "RESTRICT"
    }
    assert category_foreign_keys[0]["options"].get("ondelete") == "RESTRICT"
    assert item_foreign_keys[0]["options"].get("ondelete") == "SET NULL"


def test_upgrade_preserves_data_from_pre_migration_schema(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'legacy.db'}"
    engine = create_engine(database_url)
    statements = [
        "CREATE TABLE clients (name VARCHAR(160) NOT NULL, email VARCHAR(254), "
        "phone VARCHAR(40), notes TEXT, id VARCHAR(36) PRIMARY KEY, "
        "created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)",
        "CREATE INDEX ix_clients_name ON clients (name)",
        "CREATE TABLE items (name VARCHAR(120) NOT NULL, item_type VARCHAR(80) NOT NULL, "
        "is_active BOOLEAN NOT NULL, id VARCHAR(36) PRIMARY KEY, "
        "created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)",
        "CREATE INDEX ix_items_name ON items (name)",
        "CREATE TABLE bookings (item_id VARCHAR(36) NOT NULL, client_id VARCHAR(36) NOT NULL, "
        "start_at DATETIME NOT NULL, end_at DATETIME NOT NULL, status VARCHAR(32) NOT NULL, "
        "notes TEXT, id VARCHAR(36) PRIMARY KEY, created_at DATETIME NOT NULL, "
        "updated_at DATETIME NOT NULL, FOREIGN KEY(item_id) REFERENCES items(id), "
        "FOREIGN KEY(client_id) REFERENCES clients(id))",
        "CREATE INDEX ix_bookings_item_id ON bookings (item_id)",
        "CREATE INDEX ix_bookings_client_id ON bookings (client_id)",
        "CREATE INDEX ix_bookings_start_at ON bookings (start_at)",
        "CREATE INDEX ix_bookings_end_at ON bookings (end_at)",
        "INSERT INTO clients VALUES ('Ada', NULL, NULL, NULL, 'client-1', CURRENT_TIMESTAMP, "
        "CURRENT_TIMESTAMP)",
        "INSERT INTO items VALUES ('Stoel 1', 'resource', 1, 'item-1', CURRENT_TIMESTAMP, "
        "CURRENT_TIMESTAMP)",
        "INSERT INTO bookings VALUES ('item-1', 'client-1', '2026-08-24 08:00:00', "
        "'2026-08-24 09:00:00', 'confirmed', NULL, 'booking-1', CURRENT_TIMESTAMP, "
        "CURRENT_TIMESTAMP)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)
    engine.dispose()

    command.upgrade(migration_config(database_url), "head")

    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            client = connection.execute(
                text("SELECT name, is_archived FROM clients WHERE id = 'client-1'")
            ).one()
            item = connection.execute(
                text("SELECT name, category_id FROM items WHERE id = 'item-1'")
            ).one()
            booking_count = connection.execute(text("SELECT COUNT(*) FROM bookings")).scalar_one()
    finally:
        engine.dispose()

    assert client == ("Ada", False)
    assert item == ("Stoel 1", None)
    assert booking_count == 1
