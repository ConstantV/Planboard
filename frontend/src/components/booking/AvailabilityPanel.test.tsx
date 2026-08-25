import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Entity, EntityCategory, EntityType, RoleDefinition } from "../../types/api";
import { AvailabilityPanel } from "./AvailabilityPanel";

const timestamp = "2026-08-24T08:00:00Z";

vi.mock("../../api/availability", () => ({
  findAvailability: vi.fn(),
}));

const entityType: EntityType = {
  id: "type-1",
  key: "station",
  name: "Werkplek",
  color: "#ff0000",
  is_active: true,
  fields: [],
  roles: [],
  created_at: timestamp,
  updated_at: timestamp,
};

const role: RoleDefinition = {
  id: "role-1",
  key: "station",
  label: "Werkplek",
  booking_scope: "default",
  entity_type_id: entityType.id,
  is_required: true,
  allow_multiple: false,
  is_exclusive: true,
  display_order: 0,
  is_active: true,
  created_at: timestamp,
  updated_at: timestamp,
};

const entity: Entity = {
  id: "entity-1",
  name: "Station 1",
  entity_type_id: entityType.id,
  entity_type_key: "station",
  entity_type_name: "Werkplek",
  category_id: null,
  category_path: [],
  color: null,
  resolved_color: "#ff0000",
  is_active: true,
  values: {},
  created_at: timestamp,
  updated_at: timestamp,
};

const category: EntityCategory = {
  id: "cat-1",
  name: "Standaard",
  parent_id: null,
  color: null,
  is_active: true,
  path: ["Standaard"],
  created_at: timestamp,
  updated_at: timestamp,
};

describe("AvailabilityPanel", () => {
  it("renders available entities", async () => {
    const { findAvailability } = await import("../../api/availability");
    vi.mocked(findAvailability).mockResolvedValueOnce([entity]);

    render(
      <AvailabilityPanel
        filters={{}}
        entityTypes={[entityType]}
        roles={[role]}
        categories={[category]}
      />,
    );

    expect(await screen.findByText("Station 1")).toBeInTheDocument();
    expect(screen.getByText("Werkplek")).toBeInTheDocument();
  });

  it("shows empty state when no entities are available", async () => {
    const { findAvailability } = await import("../../api/availability");
    vi.mocked(findAvailability).mockResolvedValueOnce([]);

    render(
      <AvailabilityPanel
        filters={{}}
        entityTypes={[entityType]}
        roles={[role]}
        categories={[category]}
      />,
    );

    expect(
      await screen.findByText("Geen vrije entiteiten"),
    ).toBeInTheDocument();
  });
});
