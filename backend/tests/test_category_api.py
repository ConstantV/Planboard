from fastapi.testclient import TestClient


def test_category_create_move_list_and_deactivate(api_client: TestClient) -> None:
    root = api_client.post(
        "/api/categories",
        json={"name": "Verhuur", "color": "#f59e0b"},
    ).json()
    child = api_client.post(
        "/api/categories",
        json={"name": "Voertuigen", "parent_id": root["id"]},
    ).json()
    grandchild = api_client.post(
        "/api/categories",
        json={"name": "Bestelbussen", "parent_id": child["id"]},
    ).json()

    assert grandchild["path"] == ["Verhuur", "Voertuigen", "Bestelbussen"]

    moved = api_client.patch(
        f"/api/categories/{grandchild['id']}",
        json={"parent_id": root["id"], "color": "#0ea5e9"},
    )
    listed = api_client.get("/api/categories")
    deactivated = api_client.post(f"/api/categories/{child['id']}/deactivate")

    assert moved.json()["path"] == ["Verhuur", "Bestelbussen"]
    assert moved.json()["color"] == "#0EA5E9"
    assert {item["id"] for item in listed.json()} == {root["id"], child["id"], grandchild["id"]}
    assert deactivated.json()["is_active"] is False


def test_category_cycle_and_inactive_parent_are_rejected(api_client: TestClient) -> None:
    root = api_client.post("/api/categories", json={"name": "Root"}).json()
    child = api_client.post(
        "/api/categories",
        json={"name": "Child", "parent_id": root["id"]},
    ).json()

    cycle = api_client.patch(
        f"/api/categories/{root['id']}",
        json={"parent_id": child["id"]},
    )
    api_client.post(f"/api/categories/{child['id']}/deactivate")
    inactive_parent = api_client.post(
        "/api/categories",
        json={"name": "Blocked", "parent_id": child["id"]},
    )
    missing = api_client.get("/api/categories/missing")

    assert cycle.status_code == 422
    assert cycle.json()["error"]["code"] == "invalid_category"
    assert inactive_parent.status_code == 422
    assert inactive_parent.json()["error"]["code"] == "inactive_parent"
    assert missing.status_code == 404
