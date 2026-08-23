import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";

export function ScheduleCalendar() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      editable
      selectable
      nowIndicator
      height="auto"
      events={[
        {
          id: "welcome",
          title: "First Planboard booking",
          start: `${today}T10:00:00`,
          end: `${today}T11:00:00`,
        },
      ]}
    />
  );
}
