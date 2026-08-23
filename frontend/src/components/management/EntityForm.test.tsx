import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EntityCategory, EntityType, FieldDataType } from "../../types/api";
import { EntityForm } from "./EntityForm";

const timestamp = "2026-08-23T12:00:00Z";
const field = (key: string, label: string, data_type: FieldDataType, required = false) => ({
  id: `field-${key}`, entity_type_id: "type-1", key, label, data_type,
  is_required: required, is_searchable: true, is_filterable: true,
  display_order: 0, select_options: data_type === "select" ? ["VIP", "Regulier"] : null,
  is_active: true, created_at: timestamp, updated_at: timestamp,
});
const entityType: EntityType = {
  id: "type-1", key: "customer", name: "Klant", color: "#123456", is_active: true,
  fields: [
    field("email", "E-mail", "text", true), field("visits", "Bezoeken", "number"),
    field("newsletter", "Nieuwsbrief", "boolean"), field("birthday", "Geboortedatum", "date"),
    field("segment", "Segment", "select", true),
  ],
  roles: [], created_at: timestamp, updated_at: timestamp,
};
const category: EntityCategory = {
  id: "category-1", name: "Zakelijk", parent_id: null, color: null, is_active: true,
  path: ["Zakelijk"], created_at: timestamp, updated_at: timestamp,
};

describe("EntityForm", () => {
  it("valideert verplichte gegenereerde velden", async () => {
    const user = userEvent.setup();
    render(<EntityForm entityTypes={[entityType]} categories={[category]} saving={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Entiteit aanmaken" }));

    expect(screen.getByText("Naam is verplicht.")).toBeInTheDocument();
    expect(screen.getByText("E-mail is verplicht.")).toBeInTheDocument();
    expect(screen.getByText("Segment is verplicht.")).toBeInTheDocument();
  });

  it("verstuurt alle veldtypen als getypeerde waarden", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EntityForm entityTypes={[entityType]} categories={[category]} saving={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Naam"), "Ada Lovelace");
    await user.selectOptions(screen.getByLabelText("Categorie"), "category-1");
    await user.type(screen.getByLabelText("E-mail"), "ada@example.com");
    await user.type(screen.getByLabelText("Bezoeken"), "12");
    await user.click(screen.getByLabelText("Nieuwsbrief"));
    await user.type(screen.getByLabelText("Geboortedatum"), "1815-12-10");
    await user.selectOptions(screen.getByLabelText("Segment"), "VIP");
    await user.click(screen.getByLabelText("Eigen kalenderkleur"));
    await user.click(screen.getByRole("button", { name: "Entiteit aanmaken" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ada Lovelace", entity_type_id: "type-1", category_id: "category-1",
      color: "#247483",
      values: { email: "ada@example.com", visits: 12, newsletter: true, birthday: "1815-12-10", segment: "VIP" },
    });
  });
});
