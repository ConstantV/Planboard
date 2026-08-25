import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getEntityOccupancy } from "../../api/availability";
import type { Entity, OccupancyResponse } from "../../types/api";
import { OccupancyPanel } from "./OccupancyPanel";

const timestamp = "2026-08-24T08:00:00Z";

vi.mock("../../api/availability", () => ({
  getEntityOccupancy: vi.fn(),
}));

const entity: Entity = {
  id: "entity-1",
  name: "Station 1",
  entity_type_id: "type-1",
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

const occupancy: OccupancyResponse = {
  entity_id: entity.id,
  range_start: "2026-08-24T00:00:00Z",
  range_end: "2026-08-31T00:00:00Z",
  bookings: [
    {
      id: "b-1",
      start_at: "2026-08-24T10:00:00Z",
      end_at: "2026-08-24T11:00:00Z",
      status: "confirmed",
      notes: null,
      booking_type: null,
      created_at: timestamp,
      updated_at: timestamp,
      participants: [],
    },
  ],
  free_gaps: [
    { start_at: "2026-08-24T11:00:00Z", end_at: "2026-08-24T12:00:00Z" },
  ],
};

const emptyOccupancy: OccupancyResponse = {
  entity_id: "",
  range_start: "2026-08-24T00:00:00Z",
  range_end: "2026-08-31T00:00:00Z",
  bookings: [],
  free_gaps: [],
};

describe("OccupancyPanel", () => {
  beforeEach(() => {
    vi.mocked(getEntityOccupancy).mockResolvedValue(emptyOccupancy);
  });

  it("renders bookings and free gaps", async () => {
    vi.mocked(getEntityOccupancy).mockResolvedValueOnce(occupancy);

    render(<OccupancyPanel filters={{}} entities={[entity]} />);

    expect(await screen.findByText("Bezet")).toBeInTheDocument();
    expect(screen.getAllByText("Vrij").length).toBeGreaterThanOrEqual(1);
  });

  it("filters entities by selected type", () => {
    const otherEntity = {
      ...entity,
      id: "entity-2",
      entity_type_id: "type-2",
      name: "Station 2",
    };
    render(
      <OccupancyPanel filters={{ entity_type_id: "type-2" }} entities={[entity, otherEntity]} />,
    );
    expect(screen.queryByText("Station 1")).not.toBeInTheDocument();
    expect(screen.getByText("Station 2")).toBeInTheDocument();
  });

  it("switches entity when select changes", async () => {
    vi.mocked(getEntityOccupancy).mockResolvedValueOnce(occupancy);

    const second = { ...entity, id: "entity-2", name: "Station 2" };
    render(<OccupancyPanel filters={{}} entities={[entity, second]} />);
    expect(await screen.findByText("Station 1")).toBeInTheDocument();

    vi.mocked(getEntityOccupancy).mockResolvedValueOnce({
      ...emptyOccupancy,
      entity_id: second.id,
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Entiteit"), second.id);
    expect(screen.getByText("Station 2")).toBeInTheDocument();
  });
});
