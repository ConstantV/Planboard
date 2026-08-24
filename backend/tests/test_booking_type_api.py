from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from test_booking_api import create_booking, install_preset, participant, role


def create_booking_type(api_client: TestClient, **overrides) -> dict:
    payload = {
        "key": "knippen",
        "name": "Knippen",
        "booking_scope": "hair_salon",
        "default_duration_minutes": 45,
        "duration_mode": "suggested",
    }
    payload.update(overrides)
    response = api_client.post("/api/booking-types", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def salon_participants(api_client: TestClient) -> tuple[dict, list[dict]]:
    types = install_preset(api_client, "hair_salon")
    customer = api_client.post(
        "/api/entities",
        json={"name": "Anna", "entity_type_id": types["salon_customer"]["id"], "values": {}},
    ).json()
    hairdresser = api_client.post(
        "/api/entities",
        json={"name": "Fatima", "entity_type_id": types["hairdresser"]["id"], "values": {}},
    ).json()
    participants = [
        participant(customer, types["salon_customer"]),
        participant(hairdresser, types["hairdresser"], 1),
    ]
    return types, participants


def booking_types_by_key(api_client: TestClient, booking_scope: str) -> dict[str, dict]:
    response = api_client.get("/api/booking-types", params={"booking_scope": booking_scope})
    assert response.status_code == 200
    return {booking_type["key"]: booking_type for booking_type in response.json()}


def test_booking_type_crud_and_scope_listing(api_client: TestClient) -> None:
    created = create_booking_type(api_client)
    other_scope = create_booking_type(
        api_client,
        key="verhuur",
        name="Verhuur",
        booking_scope="rental",
        default_duration_minutes=None,
    )

    listed = api_client.get("/api/booking-types")
    scoped = api_client.get("/api/booking-types", params={"booking_scope": "hair_salon"})
    retrieved = api_client.get(f"/api/booking-types/{created['id']}")
    updated = api_client.patch(
        f"/api/booking-types/{created['id']}",
        json={"name": "Knippen en stylen", "default_duration_minutes": 60},
    )
    deactivated = api_client.post(f"/api/booking-types/{created['id']}/deactivate")
    active_only = api_client.get("/api/booking-types")
    with_inactive = api_client.get("/api/booking-types", params={"include_inactive": "true"})

    assert {item["id"] for item in listed.json()} == {created["id"], other_scope["id"]}
    assert [item["id"] for item in scoped.json()] == [created["id"]]
    assert retrieved.json()["key"] == "knippen"
    assert updated.json()["name"] == "Knippen en stylen"
    assert updated.json()["default_duration_minutes"] == 60
    assert deactivated.json()["is_active"] is False
    assert [item["key"] for item in active_only.json()] == ["verhuur"]
    assert len(with_inactive.json()) == 2


def test_booking_type_validation_and_conflicts(api_client: TestClient) -> None:
    fixed_without_duration = api_client.post(
        "/api/booking-types",
        json={
            "key": "knippen",
            "name": "Knippen",
            "booking_scope": "hair_salon",
            "duration_mode": "fixed",
        },
    )
    invalid_duration = api_client.post(
        "/api/booking-types",
        json={
            "key": "knippen",
            "name": "Knippen",
            "booking_scope": "hair_salon",
            "default_duration_minutes": 0,
        },
    )

    assert fixed_without_duration.status_code == 422
    assert invalid_duration.status_code == 422

    created = create_booking_type(api_client)
    duplicate = api_client.post(
        "/api/booking-types",
        json={"key": "knippen", "name": "Knippen", "booking_scope": "hair_salon"},
    )
    same_key_other_scope = api_client.post(
        "/api/booking-types",
        json={"key": "knippen", "name": "Knippen", "booking_scope": "rental"},
    )
    to_fixed = api_client.patch(
        f"/api/booking-types/{created['id']}",
        json={"duration_mode": "fixed"},
    )
    missing = api_client.get("/api/booking-types/unknown-id")

    assert duplicate.status_code == 409
    assert same_key_other_scope.status_code == 201
    assert to_fixed.status_code == 200
    assert missing.status_code == 404

    without_duration = create_booking_type(
        api_client,
        key="scheren",
        name="Scheren",
        default_duration_minutes=None,
    )
    invalid_fixed_update = api_client.patch(
        f"/api/booking-types/{without_duration['id']}",
        json={"duration_mode": "fixed"},
    )
    assert invalid_fixed_update.status_code == 422
    assert invalid_fixed_update.json()["error"]["code"] == "invalid_booking_type"


def test_typed_booking_suggested_duration_allows_override(api_client: TestClient) -> None:
    types, participants = salon_participants(api_client)
    booking_type = booking_types_by_key(api_client, "hair_salon")["wassen"]
    start_at = datetime(2026, 9, 7, 10, tzinfo=UTC)

    created = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(minutes=45),
        booking_type_id=booking_type["id"],
    )

    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking["booking_type"]["key"] == "wassen"
    assert booking["booking_type"]["duration_mode"] == "suggested"
    retrieved = api_client.get(f"/api/bookings/{booking['id']}")
    assert retrieved.json()["booking_type"]["id"] == booking_type["id"]
    assert types["hairdresser"]["name"] == "Kapster"


def test_typed_booking_fixed_duration_is_enforced(api_client: TestClient) -> None:
    _types, participants = salon_participants(api_client)
    booking_type = booking_types_by_key(api_client, "hair_salon")["knippen"]
    assert booking_type["duration_mode"] == "fixed"
    start_at = datetime(2026, 9, 8, 10, tzinfo=UTC)

    too_short = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(minutes=30),
        booking_type_id=booking_type["id"],
    )
    exact = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(minutes=45),
        booking_type_id=booking_type["id"],
    )

    assert too_short.status_code == 422
    assert "45 minutes" in too_short.json()["error"]["message"]
    assert exact.status_code == 201, exact.text
    booking = exact.json()

    longer_edit = api_client.patch(
        f"/api/bookings/{booking['id']}",
        json={"end_at": (start_at + timedelta(minutes=60)).isoformat()},
    )
    assert longer_edit.status_code == 422

    notes_only = api_client.patch(
        f"/api/bookings/{booking['id']}",
        json={"notes": "Alleen een notitie"},
    )
    assert notes_only.status_code == 200

    cleared = api_client.patch(
        f"/api/bookings/{booking['id']}",
        json={"booking_type_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["booking_type"] is None
    flexible_edit = api_client.patch(
        f"/api/bookings/{booking['id']}",
        json={"end_at": (start_at + timedelta(minutes=60)).isoformat()},
    )
    assert flexible_edit.status_code == 200


def test_booking_type_scope_and_state_validation(api_client: TestClient) -> None:
    types, participants = salon_participants(api_client)
    install_preset(api_client, "rental")
    rental_type = booking_types_by_key(api_client, "rental")["verhuur"]
    start_at = datetime(2026, 9, 9, 10, tzinfo=UTC)

    scope_mismatch = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(hours=1),
        booking_type_id=rental_type["id"],
    )
    unknown = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(hours=1),
        booking_type_id="missing-type",
    )

    assert scope_mismatch.status_code == 422
    assert "booking_scope" in scope_mismatch.json()["error"]["message"]
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "booking_type_not_found"

    booking_type = booking_types_by_key(api_client, "hair_salon")["wassen"]
    api_client.post(f"/api/booking-types/{booking_type['id']}/deactivate")
    inactive = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(minutes=30),
        booking_type_id=booking_type["id"],
    )
    assert inactive.status_code == 422
    assert "inactive" in inactive.json()["error"]["message"]
    assert role(types["hairdresser"])["is_active"] is True


def test_booking_type_identity_change_blocked_when_in_use(api_client: TestClient) -> None:
    _types, participants = salon_participants(api_client)
    booking_type = booking_types_by_key(api_client, "hair_salon")["wassen"]
    start_at = datetime(2026, 9, 10, 10, tzinfo=UTC)
    created = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(minutes=30),
        booking_type_id=booking_type["id"],
    )
    assert created.status_code == 201

    key_change = api_client.patch(
        f"/api/booking-types/{booking_type['id']}",
        json={"key": "wassen_lang"},
    )
    scope_change = api_client.patch(
        f"/api/booking-types/{booking_type['id']}",
        json={"booking_scope": "rental"},
    )
    name_change = api_client.patch(
        f"/api/booking-types/{booking_type['id']}",
        json={"name": "Wassen lang"},
    )

    assert key_change.status_code == 422
    assert key_change.json()["error"]["code"] == "booking_type_in_use"
    assert scope_change.status_code == 422
    assert name_change.status_code == 200
    assert name_change.json()["name"] == "Wassen lang"


def test_presets_install_booking_types(api_client: TestClient) -> None:
    install_preset(api_client, "hair_salon")
    install_preset(api_client, "hair_salon")

    salon_types = booking_types_by_key(api_client, "hair_salon")
    assert set(salon_types) == {"wassen", "knippen", "scheren", "extensions"}
    assert salon_types["knippen"]["duration_mode"] == "fixed"
    assert salon_types["knippen"]["default_duration_minutes"] == 45
    assert salon_types["extensions"]["default_duration_minutes"] == 120

    install_preset(api_client, "repair_workshop")
    workshop_types = booking_types_by_key(api_client, "repair_workshop")
    assert workshop_types["diagnose"]["duration_mode"] == "fixed"
