import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";

export interface CalendarRange {
  start: Date;
  end: Date;
}

export interface CalendarSlot {
  start: Date;
  end: Date;
}

export interface CalendarEventChange {
  bookingId: string;
  start: Date;
  end: Date;
  revert: () => void;
}

export function ScheduleCalendar({
  events,
  editable = true,
  onRangeChange,
  onSelectSlot,
  onEventClick,
  onEventDrop,
  onEventResize,
}: {
  events: EventInput[];
  editable?: boolean;
  onRangeChange?: (range: CalendarRange) => void;
  onSelectSlot?: (slot: CalendarSlot) => void;
  onEventClick?: (bookingId: string) => void;
  onEventDrop?: (change: CalendarEventChange) => void;
  onEventResize?: (change: CalendarEventChange) => void;
}) {
  const handleDatesSet = (arg: DatesSetArg) => {
    onRangeChange?.({ start: arg.start, end: arg.end });
  };
  const handleSelect = (arg: DateSelectArg) => {
    onSelectSlot?.({ start: arg.start, end: arg.end });
    arg.view.calendar.unselect();
  };
  const handleEventClick = (arg: EventClickArg) => {
    if (arg.event.id) onEventClick?.(arg.event.id);
  };
  const handleEventDrop = (arg: EventDropArg) => {
    if (!arg.event.id || !onEventDrop) return;
    onEventDrop({
      bookingId: arg.event.id,
      start: arg.event.start ?? new Date(arg.event.startStr),
      end: arg.event.end ?? new Date(arg.event.endStr),
      revert: arg.revert,
    });
  };
  const handleEventResize = (arg: EventResizeDoneArg) => {
    if (!arg.event.id || !onEventResize) return;
    onEventResize({
      bookingId: arg.event.id,
      start: arg.event.start ?? new Date(arg.event.startStr),
      end: arg.event.end ?? new Date(arg.event.endStr),
      revert: arg.revert,
    });
  };

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      locale="nl"
      firstDay={1}
      nowIndicator
      height="auto"
      events={events}
      editable={editable}
      datesSet={handleDatesSet}
      selectable={onSelectSlot !== undefined}
      selectMirror
      select={handleSelect}
      eventClick={handleEventClick}
      eventDrop={handleEventDrop}
      eventResize={handleEventResize}
    />
  );
}
