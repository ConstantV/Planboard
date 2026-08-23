from fastapi.testclient import TestClient


def entity_type_payload(key: str = "vehicle") -> dict:
    return {
        "key": key,
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


def test_entity_type_full_lifecycle(api_client: TestClient) -> None:
    created = api_client.post("/api/entity-types", json=entity_type_payload())

    assert created.status_code == 201
    entity_type = created.json()
    assert entity_type["color"] == "#F59E0B"
    assert [field["key"] for field in entity_type["fields"]] == ["registration", "size"]

    retrieved = api_client.get(f"/api/entity-types/{entity_type['id']}")
    updated = api_client.patch(
        f"/api/entity-types/{entity_type['id']}",
        json={"name": "Bestelwagen", "color": None},
    )
    deactivated = api_client.post(f"/api/entity-types/{entity_type['id']}/deactivate")
    active_list = api_client.get("/api/entity-types")
    complete_list = api_client.get("/api/entity-types", params={"include_inactive": True})

    assert retrieved.status_code == 200
    assert updated.json()["name"] == "Bestelwagen"
    assert updated.json()["color"] is None
    assert deactivated.json()["is_active"] is False
    assert entity_type["id"] not in {item["id"] for item in active_list.json()}
    assert entity_type["id"] in {item["id"] for item in complete_list.json()}


def test_duplicate_and_missing_configuration_errors_are_structured(
    api_client: TestClient,
) -> None:
    first = api_client.post("/api/entity-types", json=entity_type_payload())
    duplicate = api_client.post("/api/entity-types", json=entity_type_payload())
    missing = api_client.get("/api/entity-types/missing")
    invalid = api_client.post(
        "/api/entity-types",
        json={"key": "Invalid key", "name": "Invalid", "fields": []},
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "conflict"
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "entity_type_not_found"
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "validation_error"


def test_field_definition_lifecycle_protects_existing_values(api_client: TestClient) -> None:
    entity_type = api_client.post("/api/entity-types", json=entity_type_payload()).json()
    registration = next(field for field in entity_type["fields"] if field["key"] == "registration")
    size = next(field for field in entity_type["fields"] if field["key"] == "size")
    entity = api_client.post(
        "/api/entities",
        json={
            "name": "Bus",
            "entity_type_id": entity_type["id"],
            "values": {"registration": "V-123-AB", "size": "large"},
        },
    )
    datatype_change = api_client.patch(
        f"/api/field-definitions/{registration['id']}",
        json={"data_type": "number"},
    )
    option_removal = api_client.patch(
        f"/api/field-definitions/{size['id']}",
        json={"select_options": ["small"]},
    )
    deactivated = api_client.post(f"/api/field-definitions/{size['id']}/deactivate")

    assert entity.status_code == 201
    assert datatype_change.status_code == 422
    assert "datatype" in datatype_change.json()["error"]["message"]
    assert option_removal.status_code == 422
    assert "in use" in option_removal.json()["error"]["message"]
    assert deactivated.json()["is_active"] is False


def test_new_required_field_is_blocked_when_existing_entity_has_no_value(
    api_client: TestClient,
) -> None:
    entity_type = api_client.post("/api/entity-types", json=entity_type_payload()).json()
    api_client.post(
        "/api/entities",
        json={
            "name": "Bus",
            "entity_type_id": entity_type["id"],
            "values": {"registration": "V-123-AB"},
        },
    )
    field_response = api_client.post(
        f"/api/entity-types/{entity_type['id']}/fields",
        json={"key": "brand", "label": "Merk", "data_type": "text"},
    )

    response = api_client.patch(
        f"/api/field-definitions/{field_response.json()['id']}",
        json={"is_required": True},
    )

    assert response.status_code == 422
    assert "existing Entities" in response.json()["error"]["message"]


def test_role_definition_lifecycle(api_client: TestClient) -> None:
    entity_type = api_client.post("/api/entity-types", json=entity_type_payload()).json()
    created = api_client.post(
        "/api/role-definitions",
        json={
            "key": "rental_vehicle",
            "label": "Voertuig",
            "entity_type_id": entity_type["id"],
            "is_required": True,
            "is_exclusive": True,
        },
    )
    role = created.json()
    updated = api_client.patch(
        f"/api/role-definitions/{role['id']}",
        json={"label": "Verhuurvoertuig", "allow_multiple": True},
    )
    listed = api_client.get(
        "/api/role-definitions",
        params={"entity_type_id": entity_type["id"]},
    )
    deactivated = api_client.post(f"/api/role-definitions/{role['id']}/deactivate")

    assert created.status_code == 201
    assert updated.json()["label"] == "Verhuurvoertuig"
    assert updated.json()["allow_multiple"] is True
    assert [item["id"] for item in listed.json()] == [role["id"]]
    assert deactivated.json()["is_active"] is False


def test_preset_endpoint_is_idempotent(api_client: TestClient) -> None:
    first = api_client.post("/api/presets/hair_salon")
    second = api_client.post("/api/presets/hair_salon")
    missing = api_client.post("/api/presets/unknown")

    assert first.status_code == 200
    assert len(first.json()) == 3
    assert {item["id"] for item in first.json()} == {item["id"] for item in second.json()}
    assert missing.status_code == 404
