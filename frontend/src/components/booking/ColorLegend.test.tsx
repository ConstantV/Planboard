import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EntityType } from "../../types/api";
import { ColorLegend } from "./ColorLegend";

const base: EntityType = {
  id: "type-1",
  key: "customer",
  name: "Klant",
  color: "#ff0000",
  is_active: true,
  fields: [],
  roles: [],
  created_at: "2026-08-24T08:00:00Z",
  updated_at: "2026-08-24T08:00:00Z",
};

describe("ColorLegend", () => {
  it("renders a legend item for active types with a color", () => {
    render(<ColorLegend entityTypes={[base]} />);
    expect(screen.getByText("Klant")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Legenda entiteittypen" })).toBeInTheDocument();
  });

  it("returns null when no active types have a color", () => {
    const { container } = render(
      <ColorLegend entityTypes={[{ ...base, color: null }]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
