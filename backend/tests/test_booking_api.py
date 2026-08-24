import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient


def install_preset(api_client: TestClient, preset: str) -> dict[str, dict]:
    response = api_client.post(f"/api/presets/{preset}")
    assert response.status_code == 200
    return {entity_type["key"]: entity_type for entity_type in response.json()}


def create_entity(
    api_client: TestClient,
    entity_type: dict,
    name: str,
    *,
    values: dict | None = None,
    category_id: str | None = None,
) -> dict:
    response = api_client.post(
        "/api/entities",
        json={
            "name": name,
            "entity_type_id": entity_type["id"],
            "category_id": category_id,
            "values": values or {},
        },
    )
    assert response.status_code == 201
    return response.json()


def role(entity_type: dict) -> dict:
    return entity_type["roles"][0]


def participant(entity: dict, entity_type: dict, order: int = 0) -> dict:
    return {
        "entity_id": entity["id"],
        "role_definition_id": role(entity_type)["id"],
        "display_order": order,
    }


def create_booking(
    api_client: TestClient,
    participants: list[dict],
    start_at: datetime,
    end_at: datetime,
    **extra,
):
    return api_client.post(
        "/api/bookings",
        json={
            "participants": participants,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            **extra,
        },
    )


def salon_setup(api_client: TestClient) -> tuple[dict, list[dict]]:
    types = install_preset(api_client, "hair_salon")
    customer = create_entity(api_client, types["salon_customer"], "Anna")
    hairdresser = create_entity(api_client, types["hairdresser"], "Fatima")
    station = create_entity(api_client, types["salon_station"], "Stoel 1")
    participants = [
        participant(customer, types["salon_customer"]),
        participant(hairdresser, types["hairdresser"], 1),
        participant(station, types["salon_station"], 2),
    ]
    return types, participants


def test_booking_lifecycle_cancel_and_delete_rules(api_client: TestClient) -> None:
    _types, participants = salon_setup(api_client)
    start_at = datetime(2026, 9, 1, 10, tzinfo=UTC)
    created = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(hours=1),
        notes="Knippen",
    )

    assert created.status_code == 201, created.text
    booking = created.json()
    assert [item["role_key"] for item in booking["participants"]] == [
        "salon_customer",
        "hairdresser",
        "salon_station",
    ]
    assert booking["participants"][1]["is_exclusive"] is True
    assert booking["participants"][1]["resolved_color"] == "#EC4899"

    retrieved = api_client.get(f"/api/bookings/{booking['id']}")
    updated = api_client.patch(
        f"/api/bookings/{booking['id']}",
        json={"notes": "Knippen en wassen"},
    )
    blocked_delete = api_client.delete(f"/api/bookings/{booking['id']}")
    cancelled = api_client.post(f"/api/bookings/{booking['id']}/cancel")
    deleted = api_client.delete(f"/api/bookings/{booking['id']}")

    assert retrieved.status_code == 200
    assert updated.json()["notes"] == "Knippen en wassen"
    assert blocked_delete.status_code == 409
    assert blocked_delete.json()["error"]["code"] == "booking_must_be_cancelled"
    assert cancelled.json()["status"] == "cancelled"
    assert deleted.status_code == 204
    assert api_client.get(f"/api/bookings/{booking['id']}").status_code == 404


def test_overlap_shapes_adjacent_slots_and_nonexclusive_participant(
    api_client: TestClient,
) -> None:
    types, participants = salon_setup(api_client)
    start_at = datetime(2026, 9, 2, 10, tzinfo=UTC)
    original = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(hours=1),
    ).json()

    conflict_ranges = (
        (start_at - timedelta(minutes=30), start_at + timedelta(minutes=30)),
        (start_at + timedelta(minutes=15), start_at + timedelta(minutes=45)),
        (start_at - timedelta(minutes=30), start_at + timedelta(hours=2)),
        (start_at, start_at + timedelta(hours=1)),
    )
    for conflict_start, conflict_end in conflict_ranges:
        response = create_booking(
            api_client,
            participants,
            conflict_start,
            conflict_end,
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "booking_conflict"
        details = response.json()["error"]["details"]
        assert {item["conflicting_role_key"] for item in details} == {
            "hairdresser",
            "salon_station",
        }
        assert {item["booking_id"] for item in details} == {original["id"]}

    assert (
        create_booking(
            api_client,
            participants,
            start_at - timedelta(hours=1),
            start_at,
        ).status_code
        == 201
    )
    assert (
        create_booking(
            api_client,
            participants,
            start_at + timedelta(hours=1),
            start_at + timedelta(hours=2),
        ).status_code
        == 201
    )

    other_hairdresser = create_entity(api_client, types["hairdresser"], "Sara")
    customer_only_overlap = [participants[0], participant(other_hairdresser, types["hairdresser"])]
    assert (
        create_booking(
            api_client,
            customer_only_overlap,
            start_at,
            start_at + timedelta(hours=1),
        ).status_code
        == 201
    )


def test_update_excludes_self_and_cancelled_booking_releases_slot(
    api_client: TestClient,
) -> None:
    _types, participants = salon_setup(api_client)
    first_start = datetime(2026, 9, 3, 10, tzinfo=UTC)
    second_start = first_start + timedelta(hours=2)
    first = create_booking(
        api_client,
        participants,
        first_start,
        first_start + timedelta(hours=1),
    ).json()
    second = create_booking(
        api_client,
        participants,
        second_start,
        second_start + timedelta(hours=1),
    ).json()

    self_update = api_client.patch(
        f"/api/bookings/{first['id']}",
        json={"notes": "Geen conflict met zichzelf"},
    )
    conflict = api_client.patch(
        f"/api/bookings/{second['id']}",
        json={
            "start_at": (first_start + timedelta(minutes=30)).isoformat(),
            "end_at": (first_start + timedelta(hours=1, minutes=30)).isoformat(),
        },
    )
    api_client.post(f"/api/bookings/{first['id']}/cancel")
    released = api_client.patch(
        f"/api/bookings/{second['id']}",
        json={
            "start_at": (first_start + timedelta(minutes=30)).isoformat(),
            "end_at": (first_start + timedelta(hours=1, minutes=30)).isoformat(),
        },
    )

    assert self_update.status_code == 200
    assert conflict.status_code == 409
    assert released.status_code == 200


def test_participant_role_and_cardinality_validation(api_client: TestClient) -> None:
    types, participants = salon_setup(api_client)
    start_at = datetime(2026, 9, 4, 10, tzinfo=UTC)

    missing_required = create_booking(
        api_client,
        [participants[0]],
        start_at,
        start_at + timedelta(hours=1),
    )
    mismatch = create_booking(
        api_client,
        [
            participants[0],
            {
                "entity_id": participants[0]["entity_id"],
                "role_definition_id": role(types["hairdresser"])["id"],
            },
        ],
        start_at,
        start_at + timedelta(hours=1),
    )
    duplicate = create_booking(
        api_client,
        [participants[0], participants[1], participants[1]],
        start_at,
        start_at + timedelta(hours=1),
    )
    second_customer = create_entity(api_client, types["salon_customer"], "Bram")
    too_many = create_booking(
        api_client,
        [
            participants[0],
            participant(second_customer, types["salon_customer"]),
            participants[1],
        ],
        start_at,
        start_at + timedelta(hours=1),
    )
    rental_types = install_preset(api_client, "rental")
    rental_item = create_entity(api_client, rental_types["rental_item"], "Bus")
    mixed_scope = create_booking(
        api_client,
        [participants[0], participant(rental_item, rental_types["rental_item"])],
        start_at,
        start_at + timedelta(hours=1),
    )

    assert missing_required.status_code == 422
    assert "missing required roles" in missing_required.json()["error"]["message"]
    assert mismatch.status_code == 422
    assert "does not match" in mismatch.json()["error"]["message"]
    assert duplicate.status_code == 422
    assert "duplicate participant" in duplicate.json()["error"]["message"]
    assert too_many.status_code == 422
    assert "does not allow multiple" in too_many.json()["error"]["message"]
    assert mixed_scope.status_code == 422
    assert "booking_scope" in mixed_scope.json()["error"]["message"]


@pytest.mark.parametrize(
    ("preset", "exclusive_role_keys"),
    [
        ("rental", {"rental_item", "rental_staff"}),
        ("repair_workshop", {"mechanic", "workbench"}),
    ],
)
def test_scenario_conflicts_report_every_exclusive_resource(
    api_client: TestClient,
    preset: str,
    exclusive_role_keys: set[str],
) -> None:
    types = install_preset(api_client, preset)
    participants = []
    for order, entity_type in enumerate(types.values()):
        entity = create_entity(api_client, entity_type, f"{entity_type['name']} 1")
        participants.append(participant(entity, entity_type, order))
    start_at = datetime(2026, 9, 5, 10, tzinfo=UTC)

    assert (
        create_booking(
            api_client,
            participants,
            start_at,
            start_at + timedelta(hours=1),
        ).status_code
        == 201
    )
    conflict = create_booking(
        api_client,
        participants,
        start_at + timedelta(minutes=15),
        start_at + timedelta(hours=1, minutes=15),
    )

    assert conflict.status_code == 409
    assert {
        detail["requested_role_key"] for detail in conflict.json()["error"]["details"]
    } == exclusive_role_keys


def test_booking_filters_share_one_combinable_result_set(api_client: TestClient) -> None:
    types = install_preset(api_client, "rental")
    root = api_client.post("/api/categories", json={"name": "Materieel"}).json()
    vehicles = api_client.post(
        "/api/categories",
        json={"name": "Voertuigen", "parent_id": root["id"]},
    ).json()
    tools = api_client.post("/api/categories", json={"name": "Gereedschap"}).json()
    customer = create_entity(api_client, types["rental_customer"], "Klant Alpha")
    transit = create_entity(
        api_client,
        types["rental_item"],
        "Ford Transit",
        values={"description": "Grote bus", "brand": "Ford", "model": "Transit"},
        category_id=vehicles["id"],
    )
    drill = create_entity(
        api_client,
        types["rental_item"],
        "Accuboormachine",
        values={"description": "Compact", "brand": "Bosch", "model": "GSR"},
        category_id=tools["id"],
    )
    rental_role = role(types["rental_item"])
    start_at = datetime(2026, 9, 6, 8, tzinfo=UTC)
    first = create_booking(
        api_client,
        [
            participant(customer, types["rental_customer"]),
            participant(transit, types["rental_item"], 1),
        ],
        start_at,
        start_at + timedelta(hours=2),
        notes="Ophalen bij balie, 100% bevestigd",
    ).json()
    second = create_booking(
        api_client,
        [
            participant(customer, types["rental_customer"]),
            participant(drill, types["rental_item"], 1),
        ],
        start_at + timedelta(days=1),
        start_at + timedelta(days=1, hours=2),
        status="tentative",
    ).json()

    filters = {
        "entity_type_id": types["rental_item"]["id"],
        "entity_id": transit["id"],
        "role_definition_id": rental_role["id"],
        "category_id": root["id"],
        "status": "confirmed",
        "search": "BALIE",
        "filters": json.dumps({"brand": "Ford"}),
        "range_start": (start_at - timedelta(hours=1)).isoformat(),
        "range_end": (start_at + timedelta(hours=3)).isoformat(),
    }
    combined = api_client.get("/api/bookings", params=filters)

    assert combined.status_code == 200
    assert [booking["id"] for booking in combined.json()] == [first["id"]]
    assert [
        booking["id"] for booking in api_client.get("/api/bookings", params={"search": "%"}).json()
    ] == [first["id"]]
    assert [
        booking["id"]
        for booking in api_client.get("/api/bookings", params={"status": "tentative"}).json()
    ] == [second["id"]]
    assert (
        api_client.get(
            "/api/bookings",
            params={
                "entity_type_id": types["rental_item"]["id"],
                "filters": json.dumps({"brand": "Onbekend"}),
            },
        ).json()
        == []
    )


def test_booking_filter_and_interval_errors_are_structured(api_client: TestClient) -> None:
    types = install_preset(api_client, "rental")
    no_type = api_client.get(
        "/api/bookings",
        params={"filters": json.dumps({"brand": "Ford"})},
    )
    invalid_range = api_client.get(
        "/api/bookings",
        params={
            "range_start": "2026-09-10T11:00:00+00:00",
            "range_end": "2026-09-10T10:00:00+00:00",
        },
    )
    missing_entity = api_client.get("/api/bookings", params={"entity_id": "missing"})
    invalid_field = api_client.get(
        "/api/bookings",
        params={
            "entity_type_id": types["rental_item"]["id"],
            "filters": json.dumps({"description": "not-filterable"}),
        },
    )

    assert no_type.status_code == 422
    assert no_type.json()["error"]["code"] == "invalid_booking_filter"
    assert invalid_range.status_code == 422
    assert invalid_range.json()["error"]["code"] == "invalid_booking_filter"
    assert missing_entity.status_code == 404
    assert invalid_field.status_code == 422


def test_slot_update_moves_and_resizes_booking(api_client: TestClient) -> None:
    _types, participants = salon_setup(api_client)
    start_at = datetime(2026, 9, 10, 10, tzinfo=UTC)
    booking = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(hours=1),
    ).json()

    moved_start = start_at + timedelta(hours=2)
    moved = api_client.patch(
        f"/api/bookings/{booking['id']}/slot",
        json={
            "start_at": moved_start.isoformat(),
            "end_at": (moved_start + timedelta(hours=1)).isoformat(),
        },
    )
    assert moved.status_code == 200
    assert moved.json()["start_at"] != booking["start_at"]
    assert moved.json()["end_at"] != booking["end_at"]

    resized = api_client.patch(
        f"/api/bookings/{booking['id']}/slot",
        json={
            "start_at": moved_start.isoformat(),
            "end_at": (moved_start + timedelta(hours=2)).isoformat(),
        },
    )
    assert resized.status_code == 200
    assert resized.json()["end_at"] != moved.json()["end_at"]


def test_slot_update_rejects_conflicting_exclusive_resource(api_client: TestClient) -> None:
    _types, participants = salon_setup(api_client)
    start_at = datetime(2026, 9, 11, 10, tzinfo=UTC)
    first = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(hours=1),
    ).json()

    second_start = start_at + timedelta(hours=2)
    second = create_booking(
        api_client,
        participants,
        second_start,
        second_start + timedelta(hours=1),
    ).json()

    conflict = api_client.patch(
        f"/api/bookings/{second['id']}/slot",
        json={
            "start_at": (start_at + timedelta(minutes=30)).isoformat(),
            "end_at": (start_at + timedelta(hours=1, minutes=30)).isoformat(),
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "booking_conflict"
    assert {item["booking_id"] for item in conflict.json()["error"]["details"]} == {first["id"]}


def test_slot_update_rejects_fixed_duration_resize(api_client: TestClient) -> None:
    _types, participants = salon_setup(api_client)
    cut_type = next(
        booking_type
        for booking_type in api_client.get("/api/booking-types?booking_scope=hair_salon").json()
        if booking_type["key"] == "knippen"
    )
    start_at = datetime(2026, 9, 12, 10, tzinfo=UTC)
    booking = create_booking(
        api_client,
        participants,
        start_at,
        start_at + timedelta(minutes=cut_type["default_duration_minutes"]),
        booking_type_id=cut_type["id"],
    ).json()

    wrong_duration = api_client.patch(
        f"/api/bookings/{booking['id']}/slot",
        json={
            "start_at": start_at.isoformat(),
            "end_at": (start_at + timedelta(hours=1)).isoformat(),
        },
    )
    assert wrong_duration.status_code == 422
    assert "duration" in wrong_duration.json()["error"]["message"].lower()


def test_slot_update_not_found_returns_404(api_client: TestClient) -> None:
    start_at = datetime(2026, 9, 13, 10, tzinfo=UTC)
    response = api_client.patch(
        "/api/bookings/does-not-exist/slot",
        json={
            "start_at": start_at.isoformat(),
            "end_at": (start_at + timedelta(hours=1)).isoformat(),
        },
    )
    assert response.status_code == 404
