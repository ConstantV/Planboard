import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import type {
  Booking,
  BookingInput,
  BookingType,
  Entity,
  RoleDefinition,
} from "../../types/api";
import { BookingForm, type BookingFormProps } from "./BookingForm";
import { initialBookingFormValues } from "./booking-form";

const timestamp = "2026-08-24T08:00:00Z";

const customerRole: RoleDefinition = {
  id: "role-customer", key: "salon_customer", label: "Klant", booking_scope: "hair_salon",
  entity_type_id: "type-customer", is_required: true, allow_multiple: false,
  is_exclusive: false, display_order: 0, is_active: true,
  created_at: timestamp, updated_at: timestamp,
};
const hairdresserRole: RoleDefinition = {
  id: "role-hairdresser", key: "hairdresser", label: "Kapster", booking_scope: "hair_salon",
  entity_type_id: "type-hairdresser", is_required: true, allow_multiple: false,
  is_exclusive: true, display_order: 1, is_active: true,
  created_at: timestamp, updated_at: timestamp,
};
const stationRole: RoleDefinition = {
  id: "role-station", key: "salon_station", label: "Stoel", booking_scope: "hair_salon",
  entity_type_id: "type-station", is_required: false, allow_multiple: false,
  is_exclusive: true, display_order: 2, is_active: true,
  created_at: timestamp, updated_at: timestamp,
};
const rentalRole: RoleDefinition = {
  id: "role-rental", key: "rental_item", label: "Artikel", booking_scope: "rental",
  entity_type_id: "type-item", is_required: true, allow_multiple: false,
  is_exclusive: true, display_order: 0, is_active: true,
  created_at: timestamp, updated_at: timestamp,
};
const roles = [customerRole, hairdresserRole, stationRole, rentalRole];

const customer: Entity = {
  id: "entity-anna", name: "Anna", entity_type_id: "type-customer", entity_type_key: "salon_customer",
  entity_type_name: "Klant", category_id: null, category_path: [], color: null,
  resolved_color: "#64748B", is_active: true, values: {},
  created_at: timestamp, updated_at: timestamp,
};
const hairdresser: Entity = {
  ...customer, id: "entity-fatima", name: "Fatima", entity_type_id: "type-hairdresser",
};
const bookingTypes: BookingType[] = [
  {
    id: "bt-wassen", key: "wassen", name: "Wassen", booking_scope: "hair_salon",
    default_duration_minutes: 30, duration_mode: "suggested", is_active: true,
    created_at: timestamp, updated_at: timestamp,
  },
  {
    id: "bt-knippen", key: "knippen", name: "Knippen", booking_scope: "hair_salon",
    default_duration_minutes: 45, duration_mode: "fixed", is_active: true,
    created_at: timestamp, updated_at: timestamp,
  },
];

const baseProps = {
  roles,
  bookingTypes,
  entities: [customer, hairdresser],
  error: null,
  saving: false,
  onCancel: vi.fn(),
};

function TestBookingForm(
  props: Omit<BookingFormProps, "values" | "onChange"> & {
    initialValues?: ReturnType<typeof initialBookingFormValues>;
  },
) {
  const [values, setValues] = useState(
    props.initialValues ?? initialBookingFormValues(props.booking),
  );
  return <BookingForm {...props} values={values} onChange={setValues} />;
}

async function selectSalonScope(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Workflow"), "hair_salon");
}

describe("BookingForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toont alleen de rollen van de gekozen workflow en valideert verplichte rollen", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(input: BookingInput) => void>();
    render(<TestBookingForm {...baseProps} onSubmit={onSubmit} />);

    await selectSalonScope(user);
    expect(screen.getByLabelText(/^Klant/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Kapster/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Stoel/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Artikel/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Start"), "2026-09-01T10:00");
    await user.type(screen.getByLabelText("Einde"), "2026-09-01T11:00");
    await user.click(screen.getByRole("button", { name: "Booking aanmaken" }));

    expect(await screen.findByText("Klant is verplicht.")).toBeInTheDocument();
    expect(screen.getByText("Kapster is verplicht.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stelt de voorgestelde duur voor bij typekeuze en accepteert een afwijkende eindtijd", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(input: BookingInput) => void>();
    render(<TestBookingForm {...baseProps} onSubmit={onSubmit} />);

    await selectSalonScope(user);
    await user.type(screen.getByLabelText("Start"), "2026-09-01T10:00");
    await user.selectOptions(screen.getByLabelText("Afspraaktype"), "bt-wassen");

    const endInput = screen.getByLabelText("Einde") as HTMLInputElement;
    expect(endInput.value).toBe("2026-09-01T10:30");
    expect(endInput).not.toBeDisabled();

    await user.clear(endInput);
    await user.type(endInput, "2026-09-01T10:45");
    await user.selectOptions(screen.getByLabelText(/^Klant/), "entity-anna");
    await user.selectOptions(screen.getByLabelText(/^Kapster/), "entity-fatima");
    await user.click(screen.getByRole("button", { name: "Booking aanmaken" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0];
    expect(input.booking_type_id).toBe("bt-wassen");
    expect(new Date(input.start_at).getTime()).toBe(new Date("2026-09-01T10:00").getTime());
    expect(new Date(input.end_at).getTime()).toBe(new Date("2026-09-01T10:45").getTime());
    expect(input.participants).toEqual([
      { entity_id: "entity-anna", role_definition_id: "role-customer", display_order: 0 },
      { entity_id: "entity-fatima", role_definition_id: "role-hairdresser", display_order: 100 },
    ]);
    expect(input.participants.every((item) => item.role_definition_id !== "role-station")).toBe(true);
  });

  it("handhaaft de vaste duur door de eindtijd te vergrendelen en herberekenen", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(input: BookingInput) => void>();
    render(<TestBookingForm {...baseProps} onSubmit={onSubmit} />);

    await selectSalonScope(user);
    await user.type(screen.getByLabelText("Start"), "2026-09-01T10:00");
    await user.selectOptions(screen.getByLabelText("Afspraaktype"), "bt-knippen");

    const endInput = screen.getByLabelText("Einde") as HTMLInputElement;
    expect(endInput.value).toBe("2026-09-01T10:45");
    expect(endInput).toBeDisabled();

    await user.clear(screen.getByLabelText("Start"));
    await user.type(screen.getByLabelText("Start"), "2026-09-01T14:15");
    expect(endInput.value).toBe("2026-09-01T15:00");

    await user.selectOptions(screen.getByLabelText(/^Klant/), "entity-anna");
    await user.selectOptions(screen.getByLabelText(/^Kapster/), "entity-fatima");
    await user.click(screen.getByRole("button", { name: "Booking aanmaken" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0];
    const durationMinutes =
      (new Date(input.end_at).getTime() - new Date(input.start_at).getTime()) / 60_000;
    expect(durationMinutes).toBe(45);
  });

  it("toont een conflictmelding met de blokkerende entiteit en rol", async () => {
    const user = userEvent.setup();
    const conflictError = new ApiError(
      "One or more exclusive Entities are already booked",
      "conflict",
      409,
      "booking_conflict",
      [
        {
          booking_id: "booking-9",
          entity_id: "entity-fatima",
          entity_name: "Fatima",
          requested_role_id: "role-hairdresser",
          requested_role_key: "hairdresser",
          conflicting_role_id: "role-hairdresser",
          conflicting_role_key: "hairdresser",
          start_at: "2026-09-01T09:30:00Z",
          end_at: "2026-09-01T10:15:00Z",
        },
      ],
    );
    render(<TestBookingForm {...baseProps} error={conflictError} onSubmit={vi.fn()} />);

    expect(screen.getByText("Tijdslot bezet")).toBeInTheDocument();
    expect(screen.getByText(/Fatima \(hairdresser\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(baseProps.onCancel).toHaveBeenCalled();
  });

  it("vult een bestaande booking vooraf in en werkt die bij", async () => {
    const user = userEvent.setup();
    const booking: Booking = {
      id: "booking-1",
      start_at: "2026-09-01T10:00:00Z",
      end_at: "2026-09-01T11:00:00Z",
      status: "confirmed",
      notes: "Eerste afspraak",
      booking_type: bookingTypes[0],
      created_at: timestamp,
      updated_at: timestamp,
      participants: [
        {
          id: "p-1", entity_id: "entity-anna", entity_name: "Anna",
          entity_type_id: "type-customer", entity_type_key: "salon_customer",
          role_definition_id: "role-customer", role_key: "salon_customer", role_label: "Klant",
          booking_scope: "hair_salon", is_exclusive: false, resolved_color: "#64748B",
          display_order: 0, created_at: timestamp, updated_at: timestamp,
        },
        {
          id: "p-2", entity_id: "entity-fatima", entity_name: "Fatima",
          entity_type_id: "type-hairdresser", entity_type_key: "hairdresser",
          role_definition_id: "role-hairdresser", role_key: "hairdresser", role_label: "Kapster",
          booking_scope: "hair_salon", is_exclusive: true, resolved_color: "#EC4899",
          display_order: 1, created_at: timestamp, updated_at: timestamp,
        },
      ],
    };
    const onSubmit = vi.fn<(input: BookingInput) => void>();
    render(<TestBookingForm {...baseProps} booking={booking} onSubmit={onSubmit} />);

    expect((screen.getByLabelText("Workflow") as HTMLSelectElement).value).toBe("hair_salon");
    expect((screen.getByLabelText("Afspraaktype") as HTMLSelectElement).value).toBe("bt-wassen");
    expect((screen.getByLabelText(/^Klant/) as HTMLSelectElement).value).toBe("entity-anna");
    expect((screen.getByLabelText("Notities") as HTMLTextAreaElement).value).toBe("Eerste afspraak");

    await user.clear(screen.getByLabelText("Notities"));
    await user.type(screen.getByLabelText("Notities"), "Bijgewerkt");
    await user.click(screen.getByRole("button", { name: "Booking bijwerken" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0];
    expect(input.notes).toBe("Bijgewerkt");
    expect(input.booking_type_id).toBe("bt-wassen");
    expect(input.participants).toHaveLength(2);
  });

  it("vult een geselecteerd tijdslot vooraf in bij aanmaken", () => {
    const slotStart = new Date(2026, 8, 1, 9, 30);
    const slotEnd = new Date(2026, 8, 1, 10, 15);
    render(
      <TestBookingForm
        {...baseProps}
        initialValues={initialBookingFormValues(undefined, slotStart, slotEnd)}
        onSubmit={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe("2026-09-01T09:30");
    expect((screen.getByLabelText("Einde") as HTMLInputElement).value).toBe("2026-09-01T10:15");
  });
});
