import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingFilters } from "../../api/bookings";
import type {
  Entity,
  EntityCategory,
  EntityType,
  RoleDefinition,
} from "../../types/api";
import { FilterBar } from "./FilterBar";

const timestamp = "2026-08-24T08:00:00Z";

const entityType: EntityType = {
  id: "type-1",
  key: "customer",
  name: "Klant",
  color: null,
  is_active: true,
  fields: [],
  roles: [],
  created_at: timestamp,
  updated_at: timestamp,
};

const role: RoleDefinition = {
  id: "role-1",
  key: "customer",
  label: "Klant",
  booking_scope: "default",
  entity_type_id: entityType.id,
  is_required: true,
  allow_multiple: false,
  is_exclusive: false,
  display_order: 0,
  is_active: true,
  created_at: timestamp,
  updated_at: timestamp,
};

const entity: Entity = {
  id: "entity-1",
  name: "Anna",
  entity_type_id: entityType.id,
  entity_type_key: "customer",
  entity_type_name: "Klant",
  category_id: null,
  category_path: [],
  color: null,
  resolved_color: "#64748B",
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

describe("FilterBar", () => {
  const onChange = vi.fn();
  const onClear = vi.fn();
  const onViewChange = vi.fn();
  const onExport = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
    onClear.mockReset();
    onViewChange.mockReset();
    onExport.mockReset();
  });

  function renderBar(filters: BookingFilters = {}) {
    return render(
      <FilterBar
        filters={filters}
        entityTypes={[entityType]}
        roles={[role]}
        entities={[entity]}
        categories={[category]}
        onChange={onChange}
        onClear={onClear}
        activeView="calendar"
        onViewChange={onViewChange}
        onExport={onExport}
      />,
    );
  }

  it("renders all filter controls", () => {
    renderBar();
    expect(screen.getByLabelText("Zoeken")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Entiteittype")).toBeInTheDocument();
    expect(screen.getByLabelText("Entiteit")).toBeInTheDocument();
    expect(screen.getByLabelText("Rol")).toBeInTheDocument();
    expect(screen.getByLabelText("Categorie")).toBeInTheDocument();
  });

  it("calls onChange when search input changes", () => {
    renderBar();
    fireEvent.change(screen.getByLabelText("Zoeken"), {
      target: { value: "Anna" },
    });
    expect(onChange).toHaveBeenCalledWith({ search: "Anna" });
  });

  it("filters roles by selected entity type", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.selectOptions(screen.getByLabelText("Entiteittype"), entityType.id);
    expect(onChange).toHaveBeenCalledWith({
      entity_type_id: entityType.id,
      entity_id: undefined,
      role_definition_id: undefined,
    });
  });

  it("switches view when toggled", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Lijst" }));
    expect(onViewChange).toHaveBeenCalledWith("list");
  });

  it("exports CSV when export button clicked", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(onExport).toHaveBeenCalled();
  });

  it("shows active filters as chips and allows clearing", async () => {
    const user = userEvent.setup();
    renderBar({ search: "Anna", status: "confirmed" });
    const chips = screen.getByTestId("active-filters");
    expect(within(chips).getByText("Zoek: Anna")).toBeInTheDocument();
    expect(within(chips).getByText("Bevestigd")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Wis alles/ }));
    expect(onClear).toHaveBeenCalled();
  });
});
