import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleCalendar, type CalendarEventChange } from "./ScheduleCalendar";

const mockDrop = vi.fn();
const mockResize = vi.fn();
const mockRangeChange = vi.fn();
const mockSelectSlot = vi.fn();
const mockEventClick = vi.fn();
const mockRevert = vi.fn();

vi.mock("@fullcalendar/react", () => ({
  default: ({
    editable,
    slotMinTime,
    slotMaxTime,
    eventDrop,
    eventResize,
    datesSet,
    select,
    eventClick,
  }: {
    editable?: boolean;
    slotMinTime?: string;
    slotMaxTime?: string;
    eventDrop?: (arg: {
      event: { id: string; start: Date; end: Date };
      revert: () => void;
    }) => void;
    eventResize?: (arg: {
      event: { id: string; start: Date; end: Date };
      revert: () => void;
    }) => void;
    datesSet?: (arg: { start: Date; end: Date }) => void;
    select?: (arg: { start: Date; end: Date; view: { calendar: { unselect: () => void } } }) => void;
    eventClick?: (arg: { event: { id: string } }) => void;
  }) => (
    <div
      data-testid="fullcalendar"
      data-editable={String(editable)}
      data-slot-min={slotMinTime}
      data-slot-max={slotMaxTime}
    >
      <button
        type="button"
        onClick={() =>
          eventDrop?.({
            event: {
              id: "booking-1",
              start: new Date("2026-09-10T10:00:00Z"),
              end: new Date("2026-09-10T10:30:00Z"),
            },
            revert: mockRevert,
          })
        }
      >
        trigger-drop
      </button>
      <button
        type="button"
        onClick={() =>
          eventResize?.({
            event: {
              id: "booking-1",
              start: new Date("2026-09-10T10:00:00Z"),
              end: new Date("2026-09-10T11:00:00Z"),
            },
            revert: mockRevert,
          })
        }
      >
        trigger-resize
      </button>
      <button
        type="button"
        onClick={() =>
          datesSet?.({
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
          select?.({
            start: new Date("2026-09-10T09:00:00Z"),
            end: new Date("2026-09-10T09:30:00Z"),
            view: { calendar: { unselect: vi.fn() } },
          })
        }
      >
        trigger-select
      </button>
      <button
        type="button"
        onClick={() => eventClick?.({ event: { id: "booking-1" } })}
      >
        trigger-click
      </button>
    </div>
  ),
}));

vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));
vi.mock("@fullcalendar/timegrid", () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));

describe("ScheduleCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies the parent when the visible range changes", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCalendar
        events={[]}
        onRangeChange={mockRangeChange}
        onSelectSlot={mockSelectSlot}
        onEventClick={mockEventClick}
        onEventDrop={mockDrop}
        onEventResize={mockResize}
      />,
    );

    await user.click(screen.getByRole("button", { name: "trigger-range" }));

    expect(mockRangeChange).toHaveBeenCalledWith({
      start: new Date("2026-09-07T00:00:00Z"),
      end: new Date("2026-09-14T00:00:00Z"),
    });
  });

  it("notifies the parent when a slot is selected", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCalendar
        events={[]}
        onRangeChange={mockRangeChange}
        onSelectSlot={mockSelectSlot}
        onEventClick={mockEventClick}
        onEventDrop={mockDrop}
        onEventResize={mockResize}
      />,
    );

    await user.click(screen.getByRole("button", { name: "trigger-select" }));

    expect(mockSelectSlot).toHaveBeenCalledWith({
      start: new Date("2026-09-10T09:00:00Z"),
      end: new Date("2026-09-10T09:30:00Z"),
    });
  });

  it("notifies the parent when an event is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCalendar
        events={[]}
        onRangeChange={mockRangeChange}
        onSelectSlot={mockSelectSlot}
        onEventClick={mockEventClick}
        onEventDrop={mockDrop}
        onEventResize={mockResize}
      />,
    );

    await user.click(screen.getByRole("button", { name: "trigger-click" }));

    expect(mockEventClick).toHaveBeenCalledWith("booking-1");
  });

  it("forwards a drop change with ISO timestamps and a revert callback", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCalendar
        events={[]}
        onRangeChange={mockRangeChange}
        onSelectSlot={mockSelectSlot}
        onEventClick={mockEventClick}
        onEventDrop={mockDrop}
        onEventResize={mockResize}
      />,
    );

    await user.click(screen.getByRole("button", { name: "trigger-drop" }));

    expect(mockDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        start: new Date("2026-09-10T10:00:00Z"),
        end: new Date("2026-09-10T10:30:00Z"),
      }) as CalendarEventChange,
    );
    expect(typeof (mockDrop.mock.calls[0] as CalendarEventChange[])[0].revert).toBe("function");
  });

  it("forwards a resize change with ISO timestamps and a revert callback", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCalendar
        events={[]}
        onRangeChange={mockRangeChange}
        onSelectSlot={mockSelectSlot}
        onEventClick={mockEventClick}
        onEventDrop={mockDrop}
        onEventResize={mockResize}
      />,
    );

    await user.click(screen.getByRole("button", { name: "trigger-resize" }));

    expect(mockResize).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        start: new Date("2026-09-10T10:00:00Z"),
        end: new Date("2026-09-10T11:00:00Z"),
      }) as CalendarEventChange,
    );
  });

  it("passes the editable prop to the calendar", () => {
    const { rerender } = render(
      <ScheduleCalendar events={[]} editable onEventDrop={mockDrop} onEventResize={mockResize} />,
    );
    expect(screen.getByTestId("fullcalendar").dataset.editable).toBe("true");

    rerender(
      <ScheduleCalendar events={[]} editable={false} onEventDrop={mockDrop} onEventResize={mockResize} />,
    );
    expect(screen.getByTestId("fullcalendar").dataset.editable).toBe("false");
  });

  it("forwards configured business-hours boundaries to the calendar", () => {
    render(
      <ScheduleCalendar
        events={[]}
        slotMinTime="08:00"
        slotMaxTime="19:00"
        onEventDrop={mockDrop}
        onEventResize={mockResize}
      />,
    );
    expect(screen.getByTestId("fullcalendar").dataset.slotMin).toBe("08:00");
    expect(screen.getByTestId("fullcalendar").dataset.slotMax).toBe("19:00");
  });
});
