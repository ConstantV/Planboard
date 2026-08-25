import { useCallback, useMemo, useState } from "react";

import {
  cancelBooking,
  createBooking,
  listBookings,
  type BookingFilters,
  updateBooking,
  updateBookingSlot,
} from "../api/bookings";
import { listBookingTypes } from "../api/bookingTypes";
import { listBusinessHours } from "../api/businessHours";
import { listEntityTypes, listRoleDefinitions } from "../api/configuration";
import { listCategories, listEntities } from "../api/entities";
import { queryString } from "../api/client";
import { BookingDetails } from "../components/booking/BookingDetails";
import { BookingForm, type BookingFormValues } from "../components/booking/BookingForm";
import { AvailabilityPanel } from "../components/booking/AvailabilityPanel";
import { BookingList } from "../components/booking/BookingList";
import { BookingModal } from "../components/booking/BookingModal";
import { ColorLegend } from "../components/booking/ColorLegend";
import { FilterBar } from "../components/booking/FilterBar";
import { OccupancyPanel } from "../components/booking/OccupancyPanel";
import {
  initialBookingFormValues,
  slotEndWithDuration,
} from "../components/booking/booking-form";
import type {
  CalendarEventChange,
  CalendarRange,
  CalendarSlot,
} from "../components/ScheduleCalendar";
import { MutationFeedback } from "../components/MutationFeedback";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { ScheduleCalendar } from "../components/ScheduleCalendar";
import { useApiResource } from "../hooks/useApiResource";
import { useMutationFeedback } from "../hooks/useMutationFeedback";
import { bookingToEvent } from "../mappers/booking";
import type { Booking, BookingInput, BookingType, BusinessHours } from "../types/api";

function businessHoursTimeRange(hours: BusinessHours[] | undefined): {
  slotMinTime: string;
  slotMaxTime: string;
} {
  const open = hours?.filter((item) => !item.is_closed) ?? [];
  if (open.length === 0) return { slotMinTime: "00:00", slotMaxTime: "24:00" };
  const earliestStart = open.reduce((min, item) =>
    item.start_time < min.start_time ? item : min,
  ).start_time;
  const latestEnd = open.reduce((max, item) =>
    item.end_time > max.end_time ? item : max,
  ).end_time;
  return { slotMinTime: earliestStart.slice(0, 5), slotMaxTime: latestEnd.slice(0, 5) };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

type Selection =
  | { kind: "create"; slot?: CalendarSlot }
  | { kind: "detail"; booking: Booking }
  | { kind: "edit"; booking: Booking };

function createFormValues(
  selection: Selection,
  bookingTypes: BookingType[],
): BookingFormValues {
  if (selection.kind === "create") {
    const values = initialBookingFormValues(undefined, selection.slot?.start, selection.slot?.end);
    if (selection.slot?.start && selection.slot?.end && values.bookingTypeId) {
      return {
        ...values,
        end: slotEndWithDuration(
          selection.slot.start,
          selection.slot.end,
          values.bookingTypeId,
          bookingTypes,
        ),
      };
    }
    return values;
  }
  return initialBookingFormValues(selection.booking);
}

const emptyFilters: BookingFilters = {};

export function PlanningPage() {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [filters, setFilters] = useState<BookingFilters>(emptyFilters);
  const [manualRange, setManualRange] = useState(false);
  const [activeView, setActiveView] = useState<
    "calendar" | "list" | "availability" | "occupancy"
  >("calendar");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [formValues, setFormValues] = useState<BookingFormValues | null>(null);

  const effectiveFilters = useMemo(() => {
    const base: BookingFilters = { ...filters };
    if (!manualRange && range) {
      base.range_start = range.start.toISOString();
      base.range_end = range.end.toISOString();
    }
    return base;
  }, [filters, manualRange, range]);

  const bookingsLoader = useCallback(
    () => listBookings(effectiveFilters),
    [effectiveFilters],
  );
  const bookings = useApiResource(bookingsLoader);

  const supportLoader = useCallback(async () => {
    const [roles, bookingTypes, entities, categories, businessHours, entityTypes] =
      await Promise.all([
        listRoleDefinitions(),
        listBookingTypes(),
        listEntities(),
        listCategories(),
        listBusinessHours(),
        listEntityTypes(),
      ]);
    return { roles, bookingTypes, entities, categories, businessHours, entityTypes };
  }, []);
  const support = useApiResource(supportLoader);

  const mutation = useMutationFeedback();

  const refresh = async () => {
    setSelection(null);
    setFormValues(null);
    await bookings.reload();
  };

  const submitBooking = async (input: BookingInput, booking?: Booking) => {
    const result = await mutation.run(
      () => (booking ? updateBooking(booking.id, input) : createBooking(input)),
      booking ? "Booking bijgewerkt." : "Booking aangemaakt.",
    );
    if (result !== null) await refresh();
  };

  const removeBooking = async (booking: Booking) => {
    if (!window.confirm("Deze booking annuleren? Het tijdslot komt weer vrij.")) return;
    const result = await mutation.run(
      () => cancelBooking(booking.id),
      "Booking geannuleerd.",
    );
    if (result !== null) await refresh();
  };

  const changeSlot = async (change: CalendarEventChange) => {
    const result = await mutation.run(
      () =>
        updateBookingSlot(change.bookingId, {
          start_at: change.start.toISOString(),
          end_at: change.end.toISOString(),
        }),
      "Booking verplaatst.",
    );
    if (result !== null) {
      await refresh();
    } else {
      change.revert();
    }
  };

  const openEvent = (bookingId: string) => {
    const booking = bookings.data?.find((item) => item.id === bookingId);
    if (booking) {
      mutation.clear();
      const next: Selection = { kind: "detail", booking };
      setSelection(next);
      if (supportData) setFormValues(createFormValues(next, supportData.bookingTypes));
    }
  };

  const openBookingFromList = (booking: Booking) => {
    mutation.clear();
    const next: Selection = { kind: "detail", booking };
    setSelection(next);
    if (supportData) setFormValues(createFormValues(next, supportData.bookingTypes));
  };

  const updateFilters = (next: BookingFilters) => {
    setFilters(next);
    const hasRange = Boolean(next.range_start || next.range_end);
    setManualRange(hasRange);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setManualRange(false);
  };

  const exportCsv = () => {
    const url = `${API_BASE_URL}/bookings/export.csv${queryString(effectiveFilters)}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bookings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const supportData = support.data;
  const { slotMinTime, slotMaxTime } = useMemo(
    () => businessHoursTimeRange(supportData?.businessHours),
    [supportData],
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Kalender"
        title="Planning"
        description="Selecteer een tijdslot of klik op een booking om afspraken aan te maken en te beheren."
        actions={
          <button
            className="button button--primary"
            type="button"
            disabled={!supportData}
            onClick={() => {
              mutation.clear();
              const next: Selection = { kind: "create" };
              setSelection(next);
              if (supportData) setFormValues(createFormValues(next, supportData.bookingTypes));
            }}
          >
            Nieuwe booking
          </button>
        }
      />

      {mutation.error && <MutationFeedback error={mutation.error} notice={null} />}
      {mutation.notice && selection === null && (
        <MutationFeedback error={null} notice={mutation.notice} />
      )}

      {supportData && (
        <FilterBar
          filters={filters}
          entityTypes={supportData.entityTypes}
          roles={supportData.roles}
          entities={supportData.entities}
          categories={supportData.categories}
          onChange={updateFilters}
          onClear={clearFilters}
          activeView={activeView}
          onViewChange={setActiveView}
          onExport={exportCsv}
        />
      )}

      {bookings.loading && !bookings.data && <LoadingState label="Planning laden…" />}
      {bookings.error && (
        <ErrorState error={bookings.error} onRetry={() => void bookings.reload()} />
      )}

      {bookings.data && activeView === "calendar" && (
        <section className="panel calendar-panel" aria-label="Planning calendar">
          {bookings.data.length === 0 && (
            <EmptyState title="Geen bookings in deze periode">
              Selecteer een tijdslot of gebruik “Nieuwe booking” om te plannen.
            </EmptyState>
          )}
          <ScheduleCalendar
            events={bookings.data.map(bookingToEvent)}
            editable={!mutation.saving}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            onRangeChange={setRange}
            onSelectSlot={(slot) => {
              mutation.clear();
              if (selection?.kind === "create" && formValues && supportData) {
                setSelection({ kind: "create", slot });
                setFormValues({
                  ...formValues,
                  start: initialBookingFormValues(undefined, slot.start, slot.end).start,
                  end: slotEndWithDuration(
                    slot.start,
                    slot.end,
                    formValues.bookingTypeId,
                    supportData.bookingTypes,
                  ),
                });
              } else {
                const next: Selection = { kind: "create", slot };
                setSelection(next);
                setFormValues(createFormValues(next, supportData?.bookingTypes ?? []));
              }
            }}
            onEventClick={openEvent}
            onEventDrop={changeSlot}
            onEventResize={changeSlot}
          />
        </section>
      )}

      {bookings.data && activeView === "list" && (
        <BookingList bookings={bookings.data} onSelect={openBookingFromList} />
      )}

      {activeView === "availability" && supportData && (
        <AvailabilityPanel
          filters={effectiveFilters}
          entityTypes={supportData.entityTypes}
          roles={supportData.roles}
          categories={supportData.categories}
        />
      )}

      {activeView === "occupancy" && supportData && (
        <OccupancyPanel filters={effectiveFilters} entities={supportData.entities} />
      )}

      {supportData && activeView !== "availability" && activeView !== "occupancy" && (
        <ColorLegend entityTypes={supportData.entityTypes} />
      )}

      {support.loading && <LoadingState label="Formuliergegevens laden…" />}
      {support.error && (
        <ErrorState error={support.error} onRetry={() => void support.reload()} />
      )}

      {supportData && selection?.kind === "create" && formValues && (
        <BookingModal
          eyebrow="Nieuw"
          title="Booking aanmaken"
          onClose={() => {
            mutation.clear();
            setSelection(null);
            setFormValues(null);
          }}
        >
          <BookingForm
            values={formValues}
            roles={supportData.roles}
            bookingTypes={supportData.bookingTypes}
            entities={supportData.entities}
            error={mutation.error}
            saving={mutation.saving}
            onChange={setFormValues}
            onSubmit={(input) => submitBooking(input)}
            onCancel={() => {
              mutation.clear();
              setSelection(null);
              setFormValues(null);
            }}
          />
        </BookingModal>
      )}

      {supportData && selection?.kind === "detail" && (
        <>
          <MutationFeedback error={mutation.error} notice={null} />
          <BookingDetails
            booking={selection.booking}
            saving={mutation.saving}
            onEdit={() => {
              mutation.clear();
              const next: Selection = { kind: "edit", booking: selection.booking };
              setSelection(next);
              if (supportData) setFormValues(createFormValues(next, supportData.bookingTypes));
            }}
            onCancelBooking={() => void removeBooking(selection.booking)}
            onClose={() => {
              mutation.clear();
              setSelection(null);
            }}
          />
        </>
      )}

      {supportData && selection?.kind === "edit" && formValues && (
        <BookingModal
          eyebrow="Bewerken"
          title="Booking bijwerken"
          onClose={() => {
            mutation.clear();
            setSelection({ kind: "detail", booking: selection.booking });
            setFormValues(null);
          }}
        >
          <BookingForm
            values={formValues}
            booking={selection.booking}
            roles={supportData.roles}
            bookingTypes={supportData.bookingTypes}
            entities={supportData.entities}
            error={mutation.error}
            saving={mutation.saving}
            onChange={setFormValues}
            onSubmit={(input) => submitBooking(input, selection.booking)}
            onCancel={() => {
              mutation.clear();
              setSelection({ kind: "detail", booking: selection.booking });
              setFormValues(null);
            }}
          />
        </BookingModal>
      )}
    </div>
  );
}
