from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_db
from app.main import app


def require_status(response, expected: int) -> dict:
    if response.status_code != expected:
        raise RuntimeError(f"Expected HTTP {expected}, got {response.status_code}: {response.text}")
    return response.json() if response.content else {}


def verify_scenario(client: TestClient, preset: str, start_at: datetime) -> dict:
    entity_types = require_status(client.post(f"/api/presets/{preset}"), 200)
    participants = []
    for order, entity_type in enumerate(entity_types):
        entity = require_status(
            client.post(
                "/api/entities",
                json={
                    "name": f"Acceptatie {entity_type['name']}",
                    "entity_type_id": entity_type["id"],
                    "values": {},
                },
            ),
            201,
        )
        participants.append(
            {
                "entity_id": entity["id"],
                "role_definition_id": entity_type["roles"][0]["id"],
                "display_order": order,
            }
        )

    payload = {
        "participants": participants,
        "start_at": start_at.isoformat(),
        "end_at": (start_at + timedelta(hours=1)).isoformat(),
        "notes": f"{preset} acceptatie",
    }
    original = require_status(client.post("/api/bookings", json=payload), 201)
    conflict_payload = {
        **payload,
        "start_at": (start_at + timedelta(minutes=30)).isoformat(),
        "end_at": (start_at + timedelta(hours=1, minutes=30)).isoformat(),
    }
    conflict = require_status(client.post("/api/bookings", json=conflict_payload), 409)
    require_status(client.post(f"/api/bookings/{original['id']}/cancel"), 200)
    replacement = require_status(client.post("/api/bookings", json=conflict_payload), 201)
    require_status(client.post(f"/api/bookings/{replacement['id']}/cancel"), 200)
    require_status(client.delete(f"/api/bookings/{original['id']}"), 204)
    require_status(client.delete(f"/api/bookings/{replacement['id']}"), 204)
    return {
        "scenario": preset,
        "conflicts": len(conflict["error"]["details"]),
        "released_after_cancel": True,
    }


def main() -> None:
    with TemporaryDirectory(prefix="planboard-booking-api-") as temporary_directory:
        database_path = Path(temporary_directory) / "acceptance.db"
        database_url = f"sqlite:///{database_path}"
        config = Config("alembic.ini")
        config.set_main_option("sqlalchemy.url", database_url)
        command.upgrade(config, "head")
        engine = create_engine(database_url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

        def override_get_db() -> Generator[Session, None, None]:
            with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            with TestClient(app) as client:
                start_at = datetime(2026, 9, 15, 8, tzinfo=UTC)
                results = [
                    verify_scenario(client, preset, start_at + timedelta(hours=index * 3))
                    for index, preset in enumerate(("hair_salon", "rental", "repair_workshop"))
                ]
        finally:
            app.dependency_overrides.clear()
            engine.dispose()

    print({"booking_api_acceptance": results})


if __name__ == "__main__":
    main()
