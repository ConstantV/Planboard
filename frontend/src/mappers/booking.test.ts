import { describe, expect, it } from "vitest";

import type { Booking } from "../types/api";
import { bookingToEvent } from "./booking";

const booking: Booking = {
  id: "booking-1",
  start_at: "2026-09-01T10:00:00Z",
  end_at: "2026-09-01T11:00:00Z",
  status: "confirmed",
  notes: "Knippen",
  booking_type: {
    id: "type-1",
    key: "knippen",
    name: "Knippen",
    booking_scope: "salon",
    default_duration_minutes: 45,
    duration_mode: "fixed",
    is_active: true,
    created_at: "2026-08-23T10:00:00Z",
    updated_at: "2026-08-23T10:00:00Z",
  },
  created_at: "2026-08-23T10:00:00Z",
  updated_at: "2026-08-23T10:00:00Z",
  participants: [
    {
      id: "participant-1",
      entity_id: "customer-1",
      entity_name: "Anna",
      entity_type_id: "customer-type",
      entity_type_key: "customer",
      role_definition_id: "customer-role",
      role_key: "customer",
      role_label: "Klant",
      booking_scope: "salon",
      is_exclusive: false,
      resolved_color: "#64748B",
      display_order: 0,
      created_at: "2026-08-23T10:00:00Z",
      updated_at: "2026-08-23T10:00:00Z",
    },
    {
      id: "participant-2",
      entity_id: "staff-1",
      entity_name: "Fatima",
      entity_type_id: "staff-type",
      entity_type_key: "staff",
      role_definition_id: "staff-role",
      role_key: "staff",
      role_label: "Kapster",
      booking_scope: "salon",
      is_exclusive: true,
      resolved_color: "#EC4899",
      display_order: 1,
      created_at: "2026-08-23T10:00:00Z",
      updated_at: "2026-08-23T10:00:00Z",
    },
  ],
};

describe("bookingToEvent", () => {
  it("maps the API contract to a calendar event using the exclusive Entity color", () => {
    expect(bookingToEvent(booking)).toMatchObject({
      id: "booking-1",
      title: "Anna · Fatima",
      start: booking.start_at,
      end: booking.end_at,
      backgroundColor: "#EC4899",
      extendedProps: { status: "confirmed", notes: "Knippen" },
    });
  });

  it("marks cancelled bookings without dropping them from the shared result", () => {
    expect(bookingToEvent({ ...booking, status: "cancelled" }).classNames).toEqual([
      "booking--cancelled",
    ]);
  });

  it("keeps the BookingType in extendedProps for detail and edit flows", () => {
    expect(bookingToEvent(booking).extendedProps?.booking_type).toMatchObject({
      key: "knippen",
      duration_mode: "fixed",
    });
    expect(bookingToEvent({ ...booking, booking_type: null }).extendedProps?.booking_type).toBeNull();
  });
});
