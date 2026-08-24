import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateSelectArg } from "@fullcalendar/core";

export interface CalendarRange {
  start: Date;
  end: Date;
}

export interface CalendarSlot {
  start: Date;
  end: Date;
}

export function ScheduleCalendar({
  events,
  onRangeChange,
  onSelectSlot,
  onEventClick,
}: {
  events: EventInput[];
  onRangeChange?: (range: CalendarRange) => void;
  onSelectSlot?: (slot: CalendarSlot) => void;
  onEventClick?: (bookingId: string) => void;
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
      datesSet={handleDatesSet}
      selectable={onSelectSlot !== undefined}
      selectMirror
      select={handleSelect}
      eventClick={handleEventClick}
    />
  );
}
