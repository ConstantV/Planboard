import { useCallback, useState } from "react";

import { cancelBooking, createBooking, listBookings, updateBooking } from "../api/bookings";
import { listBookingTypes } from "../api/bookingTypes";
import { listRoleDefinitions } from "../api/configuration";
import { listEntities } from "../api/entities";
import { BookingDetails } from "../components/booking/BookingDetails";
import { BookingForm } from "../components/booking/BookingForm";
import type { CalendarRange, CalendarSlot } from "../components/ScheduleCalendar";
import { MutationFeedback } from "../components/MutationFeedback";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { ScheduleCalendar } from "../components/ScheduleCalendar";
import { useApiResource } from "../hooks/useApiResource";
import { useMutationFeedback } from "../hooks/useMutationFeedback";
import { bookingToEvent } from "../mappers/booking";
import type { Booking, BookingInput } from "../types/api";

type Selection =
  | { kind: "create"; slot?: CalendarSlot }
  | { kind: "detail"; booking: Booking }
  | { kind: "edit"; booking: Booking };

export function PlanningPage() {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const bookingsLoader = useCallback(
    () =>
      listBookings(
        range
          ? {
              range_start: range.start.toISOString(),
              range_end: range.end.toISOString(),
            }
          : {},
      ),
    [range],
  );
  const bookings = useApiResource(bookingsLoader);

  const supportLoader = useCallback(async () => {
    const [roles, bookingTypes, entities] = await Promise.all([
      listRoleDefinitions(),
      listBookingTypes(),
      listEntities(),
    ]);
    return { roles, bookingTypes, entities };
  }, []);
  const support = useApiResource(supportLoader);

  const mutation = useMutationFeedback();

  const refresh = async () => {
    setSelection(null);
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

  const openEvent = (bookingId: string) => {
    const booking = bookings.data?.find((item) => item.id === bookingId);
    if (booking) {
      mutation.clear();
      setSelection({ kind: "detail", booking });
    }
  };

  const supportData = support.data;

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
              setSelection({ kind: "create" });
            }}
          >
            Nieuwe booking
          </button>
        }
      />

      {mutation.notice && selection === null && (
        <MutationFeedback error={null} notice={mutation.notice} />
      )}

      {bookings.loading && !bookings.data && <LoadingState label="Planning laden…" />}
      {bookings.error && (
        <ErrorState error={bookings.error} onRetry={() => void bookings.reload()} />
      )}
      {bookings.data && (
        <section className="panel calendar-panel" aria-label="Planning calendar">
          {bookings.data.length === 0 && (
            <EmptyState title="Geen bookings in deze periode">
              Selecteer een tijdslot of gebruik “Nieuwe booking” om te plannen.
            </EmptyState>
          )}
          <ScheduleCalendar
            events={bookings.data.map(bookingToEvent)}
            onRangeChange={setRange}
            onSelectSlot={(slot) => {
              mutation.clear();
              setSelection({ kind: "create", slot });
            }}
            onEventClick={openEvent}
          />
        </section>
      )}

      {support.loading && (
        <LoadingState label="Formuliergegevens laden…" />
      )}
      {support.error && (
        <ErrorState error={support.error} onRetry={() => void support.reload()} />
      )}

      {supportData && selection?.kind === "create" && (
        <section className="panel editor-panel" aria-label="Nieuwe booking">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nieuw</p>
              <h2>Booking aanmaken</h2>
            </div>
          </div>
          <BookingForm
            slotStart={selection.slot?.start}
            slotEnd={selection.slot?.end}
            roles={supportData.roles}
            bookingTypes={supportData.bookingTypes}
            entities={supportData.entities}
            error={mutation.error}
            saving={mutation.saving}
            onSubmit={(input) => void submitBooking(input)}
            onCancel={() => {
              mutation.clear();
              setSelection(null);
            }}
          />
        </section>
      )}

      {supportData && selection?.kind === "detail" && (
        <>
          <MutationFeedback error={mutation.error} notice={null} />
          <BookingDetails
            booking={selection.booking}
            saving={mutation.saving}
            onEdit={() => {
              mutation.clear();
              setSelection({ kind: "edit", booking: selection.booking });
            }}
            onCancelBooking={() => void removeBooking(selection.booking)}
            onClose={() => {
              mutation.clear();
              setSelection(null);
            }}
          />
        </>
      )}

      {supportData && selection?.kind === "edit" && (
        <section className="panel editor-panel" aria-label="Booking bewerken">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Bewerken</p>
              <h2>Booking bijwerken</h2>
            </div>
          </div>
          <BookingForm
            booking={selection.booking}
            roles={supportData.roles}
            bookingTypes={supportData.bookingTypes}
            entities={supportData.entities}
            error={mutation.error}
            saving={mutation.saving}
            onSubmit={(input) => void submitBooking(input, selection.booking)}
            onCancel={() => {
              mutation.clear();
              setSelection({ kind: "detail", booking: selection.booking });
            }}
          />
        </section>
      )}
    </div>
  );
}
