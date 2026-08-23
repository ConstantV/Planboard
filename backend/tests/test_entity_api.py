import json

from fastapi.testclient import TestClient


def entity_type_payload() -> dict:
    return {
        "key": "vehicle",
        "name": "Voertuig",
        "color": "#f59e0b",
        "fields": [
            {
                "key": "registration",
                "label": "Kenteken",
                "data_type": "text",
                "is_required": True,
                "is_searchable": True,
                "is_filterable": True,
            },
            {
                "key": "size",
                "label": "Klasse",
                "data_type": "select",
                "select_options": ["small", "large"],
                "is_filterable": True,
            },
        ],
    }


def setup_entities(api_client: TestClient) -> tuple[dict, dict, dict]:
    entity_type = api_client.post("/api/entity-types", json=entity_type_payload()).json()
    root = api_client.post(
        "/api/categories",
        json={"name": "Verhuur", "color": "#8b5cf6"},
    ).json()
    child = api_client.post(
        "/api/categories",
        json={"name": "Voertuigen", "parent_id": root["id"]},
    ).json()
    return entity_type, root, child


def test_entity_full_lifecycle_with_typed_values(api_client: TestClient) -> None:
    entity_type, _root, child = setup_entities(api_client)
    created = api_client.post(
        "/api/entities",
        json={
            "name": "Bus Noord",
            "entity_type_id": entity_type["id"],
            "category_id": child["id"],
            "values": {"registration": "V-123-AB", "size": "large"},
        },
    )

    assert created.status_code == 201
    entity = created.json()
    assert entity["category_path"] == ["Verhuur", "Voertuigen"]
    # Parent-category colors are not inherited: the fallback is the entity type.
    assert entity["resolved_color"] == "#F59E0B"
    assert entity["values"] == {"registration": "V-123-AB", "size": "large"}

    updated = api_client.patch(
        f"/api/entities/{entity['id']}",
        json={
            "name": "Bus Zuid",
            "color": "#22c55e",
            "values": {"registration": "V-999-ZZ", "size": "small"},
        },
    )
    retrieved = api_client.get(f"/api/entities/{entity['id']}")
    deactivated = api_client.post(f"/api/entities/{entity['id']}/deactivate")
    active_list = api_client.get("/api/entities")
    all_list = api_client.get("/api/entities", params={"include_inactive": True})

    assert updated.json()["name"] == "Bus Zuid"
    assert updated.json()["resolved_color"] == "#22C55E"
    assert retrieved.json()["values"]["registration"] == "V-999-ZZ"
    assert deactivated.json()["is_active"] is False
    assert entity["id"] not in {item["id"] for item in active_list.json()}
    assert entity["id"] in {item["id"] for item in all_list.json()}


def test_entity_search_combined_filters_and_category_descendants(
    api_client: TestClient,
) -> None:
    entity_type, root, child = setup_entities(api_client)
    for name, registration, size, category_id in (
        ("Bus Noord", "V-111-AA", "large", child["id"]),
        ("Bus Zuid", "V-222-BB", "small", child["id"]),
        ("Los object", "V-333-CC", "large", None),
    ):
        api_client.post(
            "/api/entities",
            json={
                "name": name,
                "entity_type_id": entity_type["id"],
                "category_id": category_id,
                "values": {"registration": registration, "size": size},
            },
        )

    filtered = api_client.get(
        "/api/entities",
        params={
            "entity_type_id": entity_type["id"],
            "category_id": root["id"],
            "filters": json.dumps({"size": "large"}),
        },
    )
    searched = api_client.get(
        "/api/entities",
        params={"entity_type_id": entity_type["id"], "search": "222-bb"},
    )

    assert [item["name"] for item in filtered.json()] == ["Bus Noord"]
    assert [item["name"] for item in searched.json()] == ["Bus Zuid"]


def test_entity_validation_and_filter_errors(api_client: TestClient) -> None:
    entity_type, _root, child = setup_entities(api_client)
    missing_required = api_client.post(
        "/api/entities",
        json={"name": "Bus", "entity_type_id": entity_type["id"], "values": {}},
    )
    unknown_field = api_client.post(
        "/api/entities",
        json={
            "name": "Bus",
            "entity_type_id": entity_type["id"],
            "values": {"registration": "V-1", "unknown": "x"},
        },
    )
    invalid_filters = api_client.get("/api/entities", params={"filters": "[]"})
    filter_without_type = api_client.get(
        "/api/entities",
        params={"filters": json.dumps({"size": "large"})},
    )
    api_client.post(f"/api/categories/{child['id']}/deactivate")
    inactive_category = api_client.post(
        "/api/entities",
        json={
            "name": "Bus",
            "entity_type_id": entity_type["id"],
            "category_id": child["id"],
            "values": {"registration": "V-1"},
        },
    )

    assert missing_required.status_code == 422
    assert missing_required.json()["error"]["code"] == "invalid_entity_values"
    assert unknown_field.status_code == 422
    assert invalid_filters.status_code == 422
    assert invalid_filters.json()["error"]["code"] == "invalid_filters"
    assert filter_without_type.status_code == 422
    assert inactive_category.status_code == 422


def test_inactive_entity_type_cannot_receive_new_entities(api_client: TestClient) -> None:
    entity_type = api_client.post("/api/entity-types", json=entity_type_payload()).json()
    api_client.post(f"/api/entity-types/{entity_type['id']}/deactivate")

    response = api_client.post(
        "/api/entities",
        json={
            "name": "Bus",
            "entity_type_id": entity_type["id"],
            "values": {"registration": "V-1"},
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "inactive_entity_type"
