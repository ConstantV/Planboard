import { useCallback, useMemo } from "react";

import { findAvailability } from "../../api/availability";
import type { BookingFilters } from "../../api/bookings";
import { EmptyState, ErrorState, LoadingState } from "../PageState";
import { useApiResource } from "../../hooks/useApiResource";
import type { Entity, EntityCategory, EntityType, RoleDefinition } from "../../types/api";

interface AvailabilityPanelProps {
  filters: BookingFilters;
  entityTypes: EntityType[];
  roles: RoleDefinition[];
  categories: EntityCategory[];
}

function defaultRange(): { start_at: string; end_at: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function buildAvailabilityFilters(filters: BookingFilters) {
  const range = defaultRange();
  return {
    start_at: filters.range_start ?? range.start_at,
    end_at: filters.range_end ?? range.end_at,
    role_definition_id: filters.role_definition_id,
    entity_type_id: filters.entity_type_id,
    category_id: filters.category_id,
    exclude_booking_id: undefined,
  };
}

export function AvailabilityPanel({
  filters,
  entityTypes,
  roles,
  categories,
}: AvailabilityPanelProps) {
  const availabilityFilters = useMemo(() => buildAvailabilityFilters(filters), [filters]);

  const loader = useCallback(
    () => findAvailability(availabilityFilters),
    [availabilityFilters],
  );
  const result = useApiResource(loader);

  const criteriaLabel = useMemo(() => {
    const type = entityTypes.find((t) => t.id === filters.entity_type_id);
    const role = roles.find((r) => r.id === filters.role_definition_id);
    const category = categories.find((c) => c.id === filters.category_id);
    const parts = [type?.name, role?.label, category?.name].filter(Boolean);
    return parts.length > 0 ? ` (${parts.join(", ")})` : "";
  }, [filters, entityTypes, roles, categories]);

  return (
    <div className="panel availability-panel" role="region" aria-label="Beschikbaarheid">
      <div className="availability-panel__header">
        <h2 className="availability-panel__title">Beschikbare entiteiten{criteriaLabel}</h2>
      </div>

      {result.loading && !result.data && <LoadingState label="Beschikbaarheid ophalen…" />}
      {result.error && (
        <ErrorState error={result.error} onRetry={() => void result.reload()} />
      )}

      {result.data && result.data.length === 0 && (
        <EmptyState title="Geen vrije entiteiten">
          Er zijn geen exclusieve entiteiten vrij voor het geselecteerde tijdsvenster.
        </EmptyState>
      )}

      {result.data && result.data.length > 0 && (
        <ul className="availability-panel__list">
          {result.data.map((entity: Entity) => (
            <li key={entity.id} className="availability-panel__item">
              <span
                className="color-dot"
                style={{ backgroundColor: entity.resolved_color }}
                aria-hidden="true"
              />
              <span className="availability-panel__name">{entity.name}</span>
              <span className="availability-panel__type">{entity.entity_type_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
