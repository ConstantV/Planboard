import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listEntityTypes } from "../api/configuration";
import { deactivateEntity, listCategories, listEntities } from "../api/entities";
import type { Entity, EntityCategory, EntityType } from "../types/api";
import { EntitiesPage } from "./EntitiesPage";

vi.mock("../api/configuration", () => ({ listEntityTypes: vi.fn() }));
vi.mock("../api/entities", () => ({
  listCategories: vi.fn(), listEntities: vi.fn(), createEntity: vi.fn(), updateEntity: vi.fn(),
  deactivateEntity: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deactivateCategory: vi.fn(),
}));
const timestamp = "2026-08-23T12:00:00Z";
const entityType: EntityType = {
  id: "type-1", key: "stylist", name: "Kapster", color: "#336699", is_active: true,
  fields: [{ id: "field-1", entity_type_id: "type-1", key: "available", label: "Beschikbaar", data_type: "boolean", is_required: false, is_searchable: false, is_filterable: true, display_order: 0, select_options: null, is_active: true, created_at: timestamp, updated_at: timestamp }],
  roles: [], created_at: timestamp, updated_at: timestamp,
};
const category: EntityCategory = { id: "cat-1", name: "Senior", parent_id: null, color: null, is_active: true, path: ["Senior"], created_at: timestamp, updated_at: timestamp };
const entity: Entity = { id: "entity-1", name: "Kim", entity_type_id: "type-1", entity_type_key: "stylist", entity_type_name: "Kapster", category_id: "cat-1", category_path: ["Senior"], color: null, resolved_color: "#336699", is_active: true, values: { available: true }, created_at: timestamp, updated_at: timestamp };

describe("EntitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEntityTypes).mockResolvedValue([entityType]);
    vi.mocked(listCategories).mockResolvedValue([category]);
    vi.mocked(listEntities).mockResolvedValue([entity]);
  });

  it("filtert op naam, type, categorie en configureerbaar booleanveld", async () => {
    const user = userEvent.setup();
    render(<EntitiesPage />);
    expect(await screen.findByText("Kim")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Zoeken"), "Kim");
    await user.selectOptions(screen.getByLabelText("EntiteitType"), "type-1");
    await user.selectOptions(screen.getByLabelText("Categorie"), "cat-1");
    await user.selectOptions(await screen.findByLabelText("Beschikbaar"), "true");
    await user.click(screen.getByRole("button", { name: "Zoeken" }));

    await waitFor(() => expect(listEntities).toHaveBeenLastCalledWith({
      entity_type_id: "type-1", category_id: "cat-1", search: "Kim",
      filters: { available: true }, include_inactive: false,
    }));

    await user.selectOptions(screen.getByLabelText("Beschikbaar"), "");
    await waitFor(() => expect(listEntities).toHaveBeenLastCalledWith(expect.objectContaining({ filters: undefined })));
  });

  it("opent bewerken en archiveert alleen na bevestiging", async () => {
    const user = userEvent.setup();
    vi.mocked(deactivateEntity).mockResolvedValue({ ...entity, is_active: false });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EntitiesPage />);
    await screen.findByText("Kim");

    await user.click(screen.getByRole("button", { name: "Kim bewerken" }));
    expect(screen.getByRole("button", { name: "Entiteit bijwerken" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kim archiveren" }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(deactivateEntity).toHaveBeenCalledWith("entity-1"));
    expect(await screen.findByText("Entiteit gearchiveerd.")).toBeInTheDocument();
  });
});
