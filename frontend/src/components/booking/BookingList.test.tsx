import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Booking } from "../../types/api";
import { BookingList } from "./BookingList";

const timestamp = "2026-08-24T08:00:00Z";

const booking: Booking = {
  id: "booking-1",
  start_at: "2026-09-07T10:00:00Z",
  end_at: "2026-09-07T11:00:00Z",
  status: "confirmed",
  notes: "Knippen",
  booking_type: {
    id: "bt-1",
    key: "knippen",
    name: "Knippen",
    booking_scope: "hair_salon",
    default_duration_minutes: 60,
    duration_mode: "suggested",
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  },
  created_at: timestamp,
  updated_at: timestamp,
  participants: [
    {
      id: "p-1",
      entity_id: "entity-1",
      entity_name: "Anna",
      entity_type_id: "type-1",
      entity_type_key: "customer",
      role_definition_id: "role-1",
      role_key: "customer",
      role_label: "Klant",
      booking_scope: "hair_salon",
      is_exclusive: false,
      resolved_color: "#64748B",
      display_order: 0,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ],
};

describe("BookingList", () => {
  it("renders bookings in a table", () => {
    render(<BookingList bookings={[booking]} onSelect={vi.fn()} />);
    expect(screen.getAllByText("Knippen").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("Bevestigd")).toBeInTheDocument();
  });

  it("shows empty state when there are no bookings", () => {
    render(<BookingList bookings={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("Geen bookings gevonden voor de huidige filters.")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BookingList bookings={[booking]} onSelect={onSelect} />);
    await user.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(booking);
  });
});
