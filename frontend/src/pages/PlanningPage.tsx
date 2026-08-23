import { useCallback } from "react";

import { listBookings } from "../api/bookings";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { ScheduleCalendar } from "../components/ScheduleCalendar";
import { useApiResource } from "../hooks/useApiResource";
import { bookingToEvent } from "../mappers/booking";

export function PlanningPage() {
  const loader = useCallback(() => listBookings(), []);
  const { data, error, loading, reload } = useApiResource(loader);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Kalender"
        title="Planning"
        description="Alle bookings uit de gedeelde planning-API. Filters en bewerken volgen in de volgende stappen."
        actions={
          <button className="button button--secondary" type="button" onClick={() => void reload()}>
            Vernieuwen
          </button>
        }
      />

      {loading && <LoadingState label="Planning laden…" />}
      {error && <ErrorState error={error} onRetry={() => void reload()} />}
      {data && (
        <section className="panel calendar-panel" aria-label="Planning calendar">
          {data.length === 0 && (
            <EmptyState title="Nog geen bookings">
              Zodra een booking via de API is aangemaakt, verschijnt die hier automatisch.
            </EmptyState>
          )}
          <ScheduleCalendar events={data.map(bookingToEvent)} />
        </section>
      )}
    </div>
  );
}
