import { useCallback, useMemo, useState } from "react";

import { getEntityOccupancy } from "../../api/availability";
import type { BookingFilters } from "../../api/bookings";
import { EmptyState, ErrorState, LoadingState } from "../PageState";
import { useApiResource } from "../../hooks/useApiResource";
import type { Entity } from "../../types/api";

interface OccupancyPanelProps {
  filters: BookingFilters;
  entities: Entity[];
}

function defaultRange(): { range_start: string; range_end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { range_start: start.toISOString(), range_end: end.toISOString() };
}

function formatSlot(startAt: string, endAt: string) {
  const start = new Date(startAt).toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = new Date(endAt).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} – ${end}`;
}

const statusLabel: Record<string, string> = {
  confirmed: "Bezet",
  tentative: "Optie",
  cancelled: "Geannuleerd",
};

export function OccupancyPanel({ filters, entities }: OccupancyPanelProps) {
  const filteredEntities = useMemo(() => {
    if (!filters.entity_type_id) return entities;
    return entities.filter((e) => e.entity_type_id === filters.entity_type_id);
  }, [entities, filters.entity_type_id]);

  const [selectedId, setSelectedId] = useState<string | undefined>(
    filters.entity_id ?? filteredEntities[0]?.id,
  );

  const selectedEntity = useMemo(
    () => filteredEntities.find((e) => e.id === selectedId) ?? filteredEntities[0],
    [filteredEntities, selectedId],
  );

  const range = defaultRange();
  const rangeStart = filters.range_start ?? range.range_start;
  const rangeEnd = filters.range_end ?? range.range_end;

  const loader = useCallback(
    () =>
      selectedEntity
        ? getEntityOccupancy(selectedEntity.id, rangeStart, rangeEnd)
        : Promise.resolve({ entity_id: "", range_start: rangeStart, range_end: rangeEnd, bookings: [], free_gaps: [] }),
    [selectedEntity, rangeStart, rangeEnd],
  );
  const result = useApiResource(loader);

  const items = useMemo(() => {
    if (!result.data) return [];
    const booked = result.data.bookings.map((b) => ({
      key: `booking-${b.id}`,
      kind: "booking" as const,
      start_at: b.start_at,
      end_at: b.end_at,
      label: b.booking_type?.name ?? "Booking",
      status: b.status,
    }));
    const gaps = result.data.free_gaps.map((g, index) => ({
      key: `gap-${index}`,
      kind: "gap" as const,
      start_at: g.start_at,
      end_at: g.end_at,
      label: "Vrij",
      status: "free",
    }));
    return [...booked, ...gaps].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  }, [result.data]);

  if (filteredEntities.length === 0) {
    return (
      <div className="panel occupancy-panel" role="region" aria-label="Bezetting">
        <EmptyState title="Geen entiteiten">
          Selecteer eerst een entiteittype om de bezetting te bekijken.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="panel occupancy-panel" role="region" aria-label="Bezetting">
      <div className="occupancy-panel__header">
        <h2 className="occupancy-panel__title">Bezetting</h2>
        <label className="occupancy-panel__select-label" htmlFor="occupancy-entity">
          Entiteit
        </label>
        <select
          id="occupancy-entity"
          className="select"
          value={selectedEntity?.id ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {filteredEntities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      </div>

      {result.loading && !result.data && <LoadingState label="Bezetting ophalen…" />}
      {result.error && (
        <ErrorState error={result.error} onRetry={() => void result.reload()} />
      )}

      {result.data && items.length === 0 && (
        <EmptyState title="Geen gegevens">
          Geen bookings of vrije tijdslots gevonden voor {selectedEntity?.name} in deze periode.
        </EmptyState>
      )}

      {result.data && items.length > 0 && (
        <ul className="occupancy-panel__list">
          {items.map((item) => (
            <li
              key={item.key}
              className={`occupancy-panel__item occupancy-panel__item--${item.status}`}
            >
              <span className="occupancy-panel__time">{formatSlot(item.start_at, item.end_at)}</span>
              <span className={`occupancy-panel__badge occupancy-panel__badge--${item.status}`}>
                {statusLabel[item.status] ?? item.label}
              </span>
              <span className="occupancy-panel__label">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
