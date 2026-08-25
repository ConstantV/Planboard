from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


def install_preset(api_client: TestClient, preset: str) -> dict[str, dict]:
    response = api_client.post(f"/api/presets/{preset}")
    assert response.status_code == 200
    return {entity_type["key"]: entity_type for entity_type in response.json()}


def create_entity(api_client: TestClient, entity_type: dict, name: str) -> dict:
    response = api_client.post(
        "/api/entities",
        json={
            "name": name,
            "entity_type_id": entity_type["id"],
            "category_id": None,
            "values": {},
        },
    )
    assert response.status_code == 201
    return response.json()


def participant(entity: dict, entity_type: dict, order: int = 0) -> dict:
    return {
        "entity_id": entity["id"],
        "role_definition_id": entity_type["roles"][0]["id"],
        "display_order": order,
    }


def test_list_business_hours_returns_seven_days(api_client: TestClient) -> None:
    response = api_client.get("/api/business-hours")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 7
    assert {item["day_of_week"] for item in items} == set(range(7))


def test_update_business_hours_round_trips(api_client: TestClient) -> None:
    payload = {
        "hours": [
            {"day_of_week": day, "start_time": "08:00", "end_time": "17:00", "is_closed": day >= 5}
            for day in range(7)
        ]
    }
    response = api_client.put("/api/business-hours", json=payload)
    assert response.status_code == 200
    updated = response.json()
    assert all(item["start_time"] == "08:00" and item["end_time"] == "17:00" for item in updated)

    response = api_client.get("/api/business-hours")
    assert response.status_code == 200
    items = response.json()
    assert all(item["start_time"] == "08:00" for item in items)


def test_update_business_hours_rejects_invalid_interval(api_client: TestClient) -> None:
    payload = {
        "hours": [
            {"day_of_week": day, "start_time": "17:00", "end_time": "08:00", "is_closed": False}
            for day in range(7)
        ]
    }
    response = api_client.put("/api/business-hours", json=payload)
    assert response.status_code == 422


def test_booking_outside_business_hours_is_rejected(api_client: TestClient) -> None:
    types = install_preset(api_client, "hair_salon")
    customer = create_entity(api_client, types["salon_customer"], "Anna")
    hairdresser = create_entity(api_client, types["hairdresser"], "Fatima")

    start_at = datetime(2026, 9, 12, 10, tzinfo=UTC)
    response = api_client.post(
        "/api/bookings",
        json={
            "participants": [
                participant(customer, types["salon_customer"]),
                participant(hairdresser, types["hairdresser"], 1),
            ],
            "start_at": start_at.isoformat(),
            "end_at": (start_at + timedelta(hours=1)).isoformat(),
        },
    )
    assert response.status_code == 422
    assert "closed" in response.json()["error"]["message"].lower()


def test_booking_outside_open_hours_is_rejected(api_client: TestClient) -> None:
    types = install_preset(api_client, "hair_salon")
    customer = create_entity(api_client, types["salon_customer"], "Anna")
    hairdresser = create_entity(api_client, types["hairdresser"], "Fatima")

    start_at = datetime(2026, 9, 7, 7, tzinfo=UTC)
    response = api_client.post(
        "/api/bookings",
        json={
            "participants": [
                participant(customer, types["salon_customer"]),
                participant(hairdresser, types["hairdresser"], 1),
            ],
            "start_at": start_at.isoformat(),
            "end_at": (start_at + timedelta(hours=1)).isoformat(),
        },
    )
    assert response.status_code == 422
    assert "business hours" in response.json()["error"]["message"].lower()
