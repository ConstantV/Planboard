import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import {
  createFieldDefinition, installPreset, listEntityTypes, listRoleDefinitions,
} from "../api/configuration";
import type { EntityType, FieldDefinition } from "../types/api";
import { ConfigurationPage } from "./ConfigurationPage";

vi.mock("../api/configuration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/configuration")>();
  return {
    ...actual, listEntityTypes: vi.fn(), listRoleDefinitions: vi.fn(), installPreset: vi.fn(),
    createEntityType: vi.fn(), updateEntityType: vi.fn(), deactivateEntityType: vi.fn(),
    createFieldDefinition: vi.fn(), updateFieldDefinition: vi.fn(), deactivateFieldDefinition: vi.fn(),
    createRoleDefinition: vi.fn(), updateRoleDefinition: vi.fn(), deactivateRoleDefinition: vi.fn(),
  };
});
const timestamp = "2026-08-23T12:00:00Z";
const entityType: EntityType = { id: "type-1", key: "customer", name: "Klant", color: "#112233", is_active: true, fields: [], roles: [], created_at: timestamp, updated_at: timestamp };
const createdField: FieldDefinition = { id: "field-1", entity_type_id: "type-1", key: "segment", label: "Segment", data_type: "select", is_required: true, is_searchable: true, is_filterable: true, display_order: 0, select_options: ["VIP", "Regulier"], is_active: true, created_at: timestamp, updated_at: timestamp };

describe("ConfigurationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEntityTypes).mockResolvedValue([entityType]);
    vi.mocked(listRoleDefinitions).mockResolvedValue([]);
  });

  it("maakt een configureerbaar keuzelijstveld aan", async () => {
    const user = userEvent.setup();
    vi.mocked(createFieldDefinition).mockResolvedValue(createdField);
    render(<ConfigurationPage />);
    await screen.findByRole("heading", { name: "Klant" });

    await user.click(screen.getByRole("button", { name: "Veld toevoegen" }));
    await user.type(screen.getByLabelText("Veldlabel"), "Segment");
    await user.type(screen.getByLabelText("Technische sleutel"), "segment");
    await user.selectOptions(screen.getByLabelText("Datatype"), "select");
    await user.type(await screen.findByRole("textbox", { name: /Keuzes/ }), "VIP, Regulier");
    await user.click(screen.getByLabelText("Verplicht"));
    await user.click(screen.getByLabelText("Doorzoekbaar"));
    await user.click(screen.getByLabelText("Filterbaar"));
    await user.click(screen.getAllByRole("button", { name: "Veld toevoegen" })[1]);

    await waitFor(() => expect(createFieldDefinition).toHaveBeenCalledWith("type-1", {
      key: "segment", label: "Segment", data_type: "select", is_required: true,
      is_searchable: true, is_filterable: true, display_order: 0, select_options: ["VIP", "Regulier"],
    }));
    expect(await screen.findByText("Veld toegevoegd.")).toBeInTheDocument();
  });

  it("toont een duidelijke API-fout als presetinstallatie faalt", async () => {
    const user = userEvent.setup();
    vi.mocked(installPreset).mockRejectedValue(new ApiError("Preset bestaat al.", "conflict", 409));
    render(<ConfigurationPage />);
    await screen.findByRole("heading", { name: "Klant" });
    await user.click(screen.getByRole("button", { name: /Kapperszaak/ }));

    expect(await screen.findByText("Preset bestaat al.")).toBeInTheDocument();
    expect(screen.getByText("Actie niet mogelijk")).toBeInTheDocument();
  });
});
