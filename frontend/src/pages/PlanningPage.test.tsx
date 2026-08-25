import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelBooking, listBookings, updateBookingSlot } from "../api/bookings";
import { listBookingTypes } from "../api/bookingTypes";
import { listBusinessHours } from "../api/businessHours";
import { listEntityTypes, listRoleDefinitions } from "../api/configuration";
import { listCategories, listEntities } from "../api/entities";
import type { CalendarEventChange, CalendarRange, CalendarSlot } from "../components/ScheduleCalendar";
import type {
  Booking,
  BookingType,
  BusinessHours,
  Entity,
  EntityCategory,
  EntityType,
  RoleDefinition,
} from "../types/api";
import { PlanningPage } from "./PlanningPage";

vi.mock("../api/bookings", () => ({
  listBookings: vi.fn(),
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
  updateBookingSlot: vi.fn(),
  cancelBooking: vi.fn(),
}));
vi.mock("../api/bookingTypes", () => ({
  listBookingTypes: vi.fn(),
  createBookingType: vi.fn(),
  updateBookingType: vi.fn(),
  deactivateBookingType: vi.fn(),
  getBookingType: vi.fn(),
}));
vi.mock("../api/configuration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/configuration")>();
  return { ...actual, listRoleDefinitions: vi.fn(), listEntityTypes: vi.fn() };
});
vi.mock("../api/entities", () => ({
  listEntities: vi.fn(),
  listCategories: vi.fn(),
}));
vi.mock("../api/businessHours", () => ({ listBusinessHours: vi.fn() }));

vi.mock("../components/ScheduleCalendar", () => ({
  ScheduleCalendar: ({
    onRangeChange,
    onSelectSlot,
    onEventClick,
    onEventDrop,
    onEventResize,
  }: {
    events: unknown[];
    onRangeChange?: (range: CalendarRange) => void;
    onSelectSlot?: (slot: CalendarSlot) => void;
    onEventClick?: (bookingId: string) => void;
    onEventDrop?: (change: CalendarEventChange) => void;
    onEventResize?: (change: CalendarEventChange) => void;
  }) => (
    <div data-testid="schedule-calendar">
      <button
        type="button"
        onClick={() =>
          onRangeChange?.({
            start: new Date("2026-09-07T00:00:00Z"),
            end: new Date("2026-09-14T00:00:00Z"),
          })
        }
      >
        trigger-range
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectSlot?.({
            start: new Date(2026, 8, 10, 9, 0),
            end: new Date(2026, 8, 10, 9, 30),
          })
        }
      >
        trigger-select
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectSlot?.({
            start: new Date(2026, 8, 11, 14, 0),
            end: new Date(2026, 8, 11, 14, 30),
          })
        }
      >
        trigger-select-2
      </button>
      <button type="button" onClick={() => onEventClick?.("booking-1")}>
        trigger-event-click
      </button>
      <button
        type="button"
        onClick={() =>
          onEventDrop?.({
            bookingId: "booking-1",
            start: new Date("2026-09-10T10:00:00Z"),
            end: new Date("2026-09-10T10:30:00Z"),
            revert: vi.fn(),
          })
        }
      >
        trigger-event-drop
      </button>
      <button
        type="button"
        onClick={() =>
          onEventResize?.({
            bookingId: "booking-1",
            start: new Date("2026-09-10T09:00:00Z"),
            end: new Date("2026-09-10T10:00:00Z"),
            revert: vi.fn(),
          })
        }
      >
        trigger-event-resize
      </button>
    </div>
  ),
}));

const timestamp = "2026-08-24T08:00:00Z";

const businessHours: BusinessHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  id: `bh-${dayOfWeek}`,
  day_of_week: dayOfWeek,
  start_time: dayOfWeek < 5 ? "09:00:00" : "00:00:00",
  end_time: dayOfWeek < 5 ? "18:00:00" : "00:00:00",
  is_closed: dayOfWeek >= 5,
}));

const role: RoleDefinition = {
  id: "role-customer", key: "salon_customer", label: "Klant", booking_scope: "hair_salon",
  entity_type_id: "type-customer", is_required: true, allow_multiple: false,
  is_exclusive: false, display_order: 0, is_active: true,
  created_at: timestamp, updated_at: timestamp,
};
const entity: Entity = {
  id: "entity-anna", name: "Anna", entity_type_id: "type-customer", entity_type_key: "salon_customer",
  entity_type_name: "Klant", category_id: null, category_path: [], color: null,
  resolved_color: "#64748B", is_active: true, values: {},
  created_at: timestamp, updated_at: timestamp,
};
const entityType: EntityType = {
  id: "type-customer",
  key: "salon_customer",
  name: "Klant",
  color: "#64748B",
  is_active: true,
  fields: [],
  roles: [],
  created_at: timestamp,
  updated_at: timestamp,
};

const category: EntityCategory = {
  id: "cat-1",
  name: "Standaard",
  parent_id: null,
  color: null,
  is_active: true,
  path: ["Standaard"],
  created_at: timestamp,
  updated_at: timestamp,
};

const bookingType: BookingType = {
  id: "bt-wassen", key: "wassen", name: "Wassen", booking_scope: "hair_salon",
  default_duration_minutes: 30, duration_mode: "suggested", is_active: true,
  created_at: timestamp, updated_at: timestamp,
};
const booking: Booking = {
  id: "booking-1",
  start_at: "2026-09-10T09:00:00Z",
  end_at: "2026-09-10T09:30:00Z",
  status: "confirmed",
  notes: "Eerste afspraak",
  booking_type: bookingType,
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
  ],
};

describe("PlanningPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listBookings).mockResolvedValue([booking]);
    vi.mocked(listRoleDefinitions).mockResolvedValue([role]);
    vi.mocked(listBookingTypes).mockResolvedValue([bookingType]);
    vi.mocked(listEntities).mockResolvedValue([entity]);
    vi.mocked(listBusinessHours).mockResolvedValue(businessHours);
    vi.mocked(listCategories).mockResolvedValue([category]);
    vi.mocked(listEntityTypes).mockResolvedValue([entityType]);
  });

  it("laadt bookings voor de zichtbare periode na een kalender-range", async () => {
    const user = userEvent.setup();
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");
    await waitFor(() => expect(listBookings).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "trigger-range" }));

    await waitFor(() =>
      expect(listBookings).toHaveBeenCalledWith({
        range_start: "2026-09-07T00:00:00.000Z",
        range_end: "2026-09-14T00:00:00.000Z",
      }),
    );
  });

  it("opent het aanmaakformulier in een popup met het geselecteerde tijdslot", async () => {
    const user = userEvent.setup();
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-select" }));

    await screen.findByRole("dialog", { name: "Booking aanmaken" });
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe("2026-09-10T09:00");
    expect((screen.getByLabelText("Einde") as HTMLInputElement).value).toBe("2026-09-10T09:30");
  });

  it("past start- en eindtijd in de popup aan bij een tweede kalenderklik", async () => {
    const user = userEvent.setup();
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-select" }));
    await screen.findByRole("dialog", { name: "Booking aanmaken" });

    await user.click(screen.getByRole("button", { name: "trigger-select-2" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe("2026-09-11T14:00"),
    );
    expect((screen.getByLabelText("Einde") as HTMLInputElement).value).toBe("2026-09-11T14:30");
  });

  it("sluit de booking-popup via de sluitknop", async () => {
    const user = userEvent.setup();
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-select" }));
    await screen.findByRole("dialog", { name: "Booking aanmaken" });

    await user.click(screen.getByRole("button", { name: "Sluiten" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opent de bookingdetails via een kalender-event en annuleert de booking", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(cancelBooking).mockResolvedValue({ ...booking, status: "cancelled" });
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-event-click" }));

    await screen.findByRole("button", { name: "Annuleer booking" });
    await user.click(screen.getByRole("button", { name: "Annuleer booking" }));

    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith("booking-1"));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("annuleert niet wanneer de bevestiging wordt weggeklikt", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-event-click" }));
    await screen.findByRole("button", { name: "Annuleer booking" });
    await user.click(screen.getByRole("button", { name: "Annuleer booking" }));

    expect(cancelBooking).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("persisteert een kalender-drop via de slot-API", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBookingSlot).mockResolvedValue({ ...booking, start_at: "2026-09-10T10:00:00Z", end_at: "2026-09-10T10:30:00Z" });
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-event-drop" }));

    await waitFor(() =>
      expect(updateBookingSlot).toHaveBeenCalledWith("booking-1", {
        start_at: "2026-09-10T10:00:00.000Z",
        end_at: "2026-09-10T10:30:00.000Z",
      }),
    );
  });

  it("toont een foutmelding wanneer een drop door de API wordt geweigerd", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBookingSlot).mockRejectedValue(
      new Error("Conflict"),
    );
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-event-drop" }));

    await screen.findByText("Opslaan mislukt");
  });

  it("persisteert een kalender-resize via de slot-API", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBookingSlot).mockResolvedValue({ ...booking, end_at: "2026-09-10T10:00:00Z" });
    render(<PlanningPage />);
    await screen.findByTestId("schedule-calendar");

    await user.click(screen.getByRole("button", { name: "trigger-event-resize" }));

    await waitFor(() =>
      expect(updateBookingSlot).toHaveBeenCalledWith("booking-1", {
        start_at: "2026-09-10T09:00:00.000Z",
        end_at: "2026-09-10T10:00:00.000Z",
      }),
    );
  });
});
