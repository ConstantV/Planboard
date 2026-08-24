import type { EventInput } from "@fullcalendar/core";

import type { Booking } from "../types/api";

export function bookingToEvent(booking: Booking): EventInput {
  const colorParticipant =
    booking.participants.find((participant) => participant.is_exclusive) ??
    booking.participants[0];
  const isFixed = booking.booking_type?.duration_mode === "fixed";
  return {
    id: booking.id,
    title: booking.participants.map((participant) => participant.entity_name).join(" · "),
    start: booking.start_at,
    end: booking.end_at,
    backgroundColor: colorParticipant?.resolved_color,
    borderColor: colorParticipant?.resolved_color,
    classNames: booking.status === "cancelled" ? ["booking--cancelled"] : [],
    durationEditable: !isFixed,
    startEditable: true,
    editable: true,
    extendedProps: {
      status: booking.status,
      notes: booking.notes,
      participants: booking.participants,
      booking_type: booking.booking_type,
    },
  };
}
