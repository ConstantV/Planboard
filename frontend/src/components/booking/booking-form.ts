import type {
  Booking,
  BookingInput,
  BookingParticipantInput,
  BookingStatus,
  BookingType,
  RoleDefinition,
} from "../../types/api";
import { addMinutes, localInputToIso, toLocalInputValue } from "../../utils/datetime";

export interface BookingFormValues {
  scope: string;
  bookingTypeId: string;
  start: string;
  end: string;
  status: BookingStatus;
  notes: string;
  selections: Record<string, string[]>;
}

export function initialBookingFormValues(
  booking: Booking | undefined,
  slotStart?: Date,
  slotEnd?: Date,
): BookingFormValues {
  const selections: Record<string, string[]> = {};
  if (booking) {
    for (const participant of booking.participants) {
      selections[participant.role_definition_id] = [
        ...(selections[participant.role_definition_id] ?? []),
        participant.entity_id,
      ];
    }
    return {
      scope: booking.participants[0]?.booking_scope ?? "",
      bookingTypeId: booking.booking_type?.id ?? "",
      start: toLocalInputValue(new Date(booking.start_at)),
      end: toLocalInputValue(new Date(booking.end_at)),
      status: booking.status,
      notes: booking.notes ?? "",
      selections,
    };
  }
  return {
    scope: "",
    bookingTypeId: "",
    start: slotStart ? toLocalInputValue(slotStart) : "",
    end: slotEnd ? toLocalInputValue(slotEnd) : "",
    status: "confirmed",
    notes: "",
    selections,
  };
}

export function applyDurationToStart(start: string, minutes: number): string {
  const startDate = new Date(start);
  return Number.isNaN(startDate.getTime())
    ? ""
    : toLocalInputValue(addMinutes(startDate, minutes));
}

export function slotEndWithDuration(
  start: Date,
  slotEnd: Date,
  bookingTypeId: string,
  bookingTypes: BookingType[],
): string {
  const type = bookingTypes.find((item) => item.id === bookingTypeId);
  if (type?.default_duration_minutes) {
    return toLocalInputValue(addMinutes(start, type.default_duration_minutes));
  }
  return toLocalInputValue(slotEnd);
}

export function patchBookingFormValues(
  current: BookingFormValues,
  changes: Partial<BookingFormValues>,
  bookingTypes: BookingType[],
): BookingFormValues {
  let next = { ...current, ...changes };
  const nextType = bookingTypes.find((type) => type.id === next.bookingTypeId);
  if (nextType?.default_duration_minutes && ("start" in changes || "bookingTypeId" in changes)) {
    next = { ...next, end: applyDurationToStart(next.start, nextType.default_duration_minutes) };
  }
  return next;
}

export function scopeBookingFormValues(
  current: BookingFormValues,
  scope: string,
  bookingTypes: BookingType[],
): BookingFormValues {
  const nextType = bookingTypes.find((type) => type.id === current.bookingTypeId);
  return {
    ...current,
    scope,
    bookingTypeId: nextType?.booking_scope === scope ? current.bookingTypeId : "",
    selections: {},
  };
}

export function validateBookingFormValues(
  values: BookingFormValues,
  scopeRoles: RoleDefinition[],
  selectedType: BookingType | undefined,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  if (!values.scope) fieldErrors.scope = "Kies een workflow.";
  if (!values.start) fieldErrors.start = "Vul een starttijd in.";
  if (!values.end) fieldErrors.end = "Vul een eindtijd in.";
  if (values.start && values.end && new Date(values.end) <= new Date(values.start)) {
    fieldErrors.end = "De eindtijd moet na de starttijd liggen.";
  }
  if (
    selectedType?.duration_mode === "fixed" &&
    selectedType.default_duration_minutes &&
    values.end
  ) {
    const expected = applyDurationToStart(values.start, selectedType.default_duration_minutes);
    if (values.end !== expected) {
      fieldErrors.end = `${selectedType.name} duurt altijd ${selectedType.default_duration_minutes} minuten.`;
    }
  }
  for (const role of scopeRoles) {
    if (role.is_required && (values.selections[role.id] ?? []).length === 0) {
      fieldErrors[`role-${role.id}`] = `${role.label} is verplicht.`;
    }
  }
  return fieldErrors;
}

export function buildBookingInput(
  values: BookingFormValues,
  scopeRoles: RoleDefinition[],
): BookingInput {
  const participants: BookingParticipantInput[] = [];
  for (const role of scopeRoles) {
    for (const [index, entityId] of (values.selections[role.id] ?? []).entries()) {
      participants.push({
        entity_id: entityId,
        role_definition_id: role.id,
        display_order: role.display_order * 100 + index,
      });
    }
  }
  return {
    participants,
    start_at: localInputToIso(values.start),
    end_at: localInputToIso(values.end),
    status: values.status,
    notes: values.notes.trim() || null,
    booking_type_id: values.bookingTypeId || null,
  };
}
