from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def salon(api_client: TestClient):
    response = api_client.post("/api/presets/hair_salon")
    assert response.status_code == 200
    types = {entity_type["key"]: entity_type for entity_type in response.json()}

    def make(entity_type_key: str, name: str):
        r = api_client.post(
            "/api/entities",
            json={
                "name": name,
                "entity_type_id": types[entity_type_key]["id"],
                "values": {},
            },
        )
        assert r.status_code == 201
        return r.json()

    customer = make("salon_customer", "Anna")
    hairdresser1 = make("hairdresser", "Fatima")
    hairdresser2 = make("hairdresser", "Sofie")
    station = make("salon_station", "Stoel 1")

    def part(entity, type_key, order=0):
        return {
            "entity_id": entity["id"],
            "role_definition_id": types[type_key]["roles"][0]["id"],
            "display_order": order,
        }

    base = [
        part(customer, "salon_customer"),
        part(hairdresser1, "hairdresser", 1),
        part(station, "salon_station", 2),
    ]
    return {
        "types": types,
        "customer": customer,
        "hairdresser1": hairdresser1,
        "hairdresser2": hairdresser2,
        "station": station,
        "base_participants": base,
    }


def create_booking(api_client, participants, start_at, end_at, **extra):
    return api_client.post(
        "/api/bookings",
        json={
            "participants": participants,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            **extra,
        },
    )


def test_availability_finds_free_exclusive_entity(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)
    created = create_booking(api_client, salon["base_participants"], start, end)
    assert created.status_code == 201

    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    ids = {entity["id"] for entity in data}
    assert salon["hairdresser1"]["id"] not in ids
    assert salon["hairdresser2"]["id"] in ids


def test_availability_returns_empty_when_all_booked(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)

    station2 = api_client.post(
        "/api/entities",
        json={
            "name": "Stoel 2",
            "entity_type_id": salon["types"]["salon_station"]["id"],
            "values": {},
        },
    ).json()

    p1 = list(salon["base_participants"])
    p2 = [
        {
            "entity_id": salon["customer"]["id"],
            "role_definition_id": salon["types"]["salon_customer"]["roles"][0]["id"],
            "display_order": 0,
        },
        {
            "entity_id": salon["hairdresser2"]["id"],
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
            "display_order": 1,
        },
        {
            "entity_id": station2["id"],
            "role_definition_id": salon["types"]["salon_station"]["roles"][0]["id"],
            "display_order": 2,
        },
    ]

    assert create_booking(api_client, p1, start, end).status_code == 201
    assert create_booking(api_client, p2, start, end).status_code == 201

    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
        },
    )
    assert response.status_code == 200
    assert response.json() == []


def test_availability_ignores_cancelled_bookings(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)
    created = create_booking(api_client, salon["base_participants"], start, end)
    assert created.status_code == 201
    booking_id = created.json()["id"]
    assert api_client.post(f"/api/bookings/{booking_id}/cancel").status_code == 200

    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
        },
    )
    assert response.status_code == 200
    ids = {entity["id"] for entity in response.json()}
    assert salon["hairdresser1"]["id"] in ids


def test_availability_excludes_inactive_entities(api_client: TestClient, salon):
    inactive_id = salon["hairdresser2"]["id"]
    assert (
        api_client.post(f"/api/entities/{inactive_id}/deactivate").status_code == 200
    )

    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)
    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
        },
    )
    assert response.status_code == 200
    ids = {entity["id"] for entity in response.json()}
    assert inactive_id not in ids


def test_availability_respects_entity_type_filter(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)
    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "entity_type_id": salon["types"]["hairdresser"]["id"],
        },
    )
    assert response.status_code == 200
    ids = {entity["id"] for entity in response.json()}
    assert salon["hairdresser1"]["id"] in ids
    assert salon["hairdresser2"]["id"] in ids
    assert salon["station"]["id"] not in ids


def test_availability_excludes_partially_occupied_entity(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=2)
    created = create_booking(
        api_client, salon["base_participants"], start, start + timedelta(hours=1)
    )
    assert created.status_code == 201

    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
        },
    )
    assert response.status_code == 200
    ids = {entity["id"] for entity in response.json()}
    assert salon["hairdresser1"]["id"] not in ids
    assert salon["hairdresser2"]["id"] in ids


def test_availability_allows_adjacent_interval(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    created = create_booking(
        api_client, salon["base_participants"], start, start + timedelta(hours=1)
    )
    assert created.status_code == 201

    next_start = start + timedelta(hours=1)
    next_end = next_start + timedelta(hours=1)
    response = api_client.get(
        "/api/availability",
        params={
            "start_at": next_start.isoformat(),
            "end_at": next_end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
        },
    )
    assert response.status_code == 200
    ids = {entity["id"] for entity in response.json()}
    assert salon["hairdresser1"]["id"] in ids


def test_availability_exclude_booking_id(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)
    created = create_booking(api_client, salon["base_participants"], start, end)
    booking_id = created.json()["id"]

    response = api_client.get(
        "/api/availability",
        params={
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "role_definition_id": salon["types"]["hairdresser"]["roles"][0]["id"],
            "exclude_booking_id": booking_id,
        },
    )
    assert response.status_code == 200
    ids = {entity["id"] for entity in response.json()}
    assert salon["hairdresser1"]["id"] in ids


def test_occupancy_returns_bookings_and_free_gaps(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 10, tzinfo=UTC)
    end = start + timedelta(hours=1)
    created = create_booking(api_client, salon["base_participants"], start, end)
    assert created.status_code == 201

    range_start = datetime(2026, 9, 7, 9, tzinfo=UTC)
    range_end = datetime(2026, 9, 7, 17, tzinfo=UTC)
    response = api_client.get(
        f"/api/entities/{salon['hairdresser1']['id']}/occupancy",
        params={
            "range_start": range_start.isoformat(),
            "range_end": range_end.isoformat(),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["bookings"]) == 1
    assert data["bookings"][0]["id"] == created.json()["id"]
    gaps = data["free_gaps"]
    assert any(gap["start_at"] == range_start.isoformat() for gap in gaps)
    assert any(gap["end_at"] == start.isoformat() for gap in gaps)
    assert any(gap["start_at"] == end.isoformat() for gap in gaps)
    assert any(gap["end_at"] == range_end.isoformat() for gap in gaps)


def test_occupancy_on_closed_day_returns_no_gaps(api_client: TestClient, salon):
    # Default business hours close Saturday and Sunday; 2026-09-05 is Saturday.
    range_start = datetime(2026, 9, 5, 9, tzinfo=UTC)
    range_end = datetime(2026, 9, 5, 17, tzinfo=UTC)
    response = api_client.get(
        f"/api/entities/{salon['hairdresser1']['id']}/occupancy",
        params={
            "range_start": range_start.isoformat(),
            "range_end": range_end.isoformat(),
        },
    )
    assert response.status_code == 200
    assert response.json()["free_gaps"] == []


def test_occupancy_rejects_invalid_interval(api_client: TestClient, salon):
    start = datetime(2026, 9, 7, 17, tzinfo=UTC)
    end = datetime(2026, 9, 7, 9, tzinfo=UTC)
    response = api_client.get(
        f"/api/entities/{salon['hairdresser1']['id']}/occupancy",
        params={
            "range_start": start.isoformat(),
            "range_end": end.isoformat(),
        },
    )
    assert response.status_code == 422
