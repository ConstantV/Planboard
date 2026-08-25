import { useMemo } from "react";

import type { BookingFilters } from "../../api/bookings";
import type {
  BookingStatus,
  Entity,
  EntityCategory,
  EntityType,
  RoleDefinition,
} from "../../types/api";

interface FilterBarProps {
  filters: BookingFilters;
  entityTypes: EntityType[];
  roles: RoleDefinition[];
  entities: Entity[];
  categories: EntityCategory[];
  onChange: (filters: BookingFilters) => void;
  onClear: () => void;
  activeView: "calendar" | "list" | "availability" | "occupancy";
  onViewChange: (view: "calendar" | "list" | "availability" | "occupancy") => void;
  onExport?: () => void;
}

const statuses: { value: BookingStatus; label: string }[] = [
  { value: "confirmed", label: "Bevestigd" },
  { value: "tentative", label: "Voorlopig" },
  { value: "cancelled", label: "Geannuleerd" },
];

const isoDate = (value: string | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export function FilterBar({
  filters,
  entityTypes,
  roles,
  entities,
  categories,
  onChange,
  onClear,
  activeView,
  onViewChange,
  onExport,
}: FilterBarProps) {
  const filteredRoles = useMemo(() => {
    if (!filters.entity_type_id) return roles;
    return roles.filter((role) => role.entity_type_id === filters.entity_type_id);
  }, [roles, filters.entity_type_id]);

  const filteredEntities = useMemo(() => {
    if (!filters.entity_type_id) return entities;
    return entities.filter(
      (entity) => entity.entity_type_id === filters.entity_type_id,
    );
  }, [entities, filters.entity_type_id]);

  const update = (changes: Partial<BookingFilters>) => {
    onChange({ ...filters, ...changes });
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (filters.search) chips.push({ key: "search", label: `Zoek: ${filters.search}` });
    if (filters.status) {
      const status = statuses.find((s) => s.value === filters.status);
      chips.push({ key: "status", label: status?.label ?? filters.status });
    }
    if (filters.entity_type_id) {
      const type = entityTypes.find((t) => t.id === filters.entity_type_id);
      if (type) chips.push({ key: "entity_type_id", label: type.name });
    }
    if (filters.entity_id) {
      const entity = entities.find((e) => e.id === filters.entity_id);
      if (entity) chips.push({ key: "entity_id", label: entity.name });
    }
    if (filters.role_definition_id) {
      const role = roles.find((r) => r.id === filters.role_definition_id);
      if (role) chips.push({ key: "role_definition_id", label: role.label });
    }
    if (filters.category_id) {
      const category = categories.find((c) => c.id === filters.category_id);
      if (category) chips.push({ key: "category_id", label: category.name });
    }
    if (filters.range_start || filters.range_end) {
      chips.push({
        key: "range",
        label: `${filters.range_start?.slice(0, 10) ?? "…"} – ${filters.range_end?.slice(0, 10) ?? "…"}`,
      });
    }
    return chips;
  }, [filters, entityTypes, entities, roles, categories]);

  const removeChip = (key: string) => {
    if (key === "search") update({ search: undefined });
    if (key === "status") update({ status: undefined });
    if (key === "entity_type_id") update({ entity_type_id: undefined, entity_id: undefined });
    if (key === "entity_id") update({ entity_id: undefined });
    if (key === "role_definition_id") update({ role_definition_id: undefined });
    if (key === "category_id") update({ category_id: undefined });
    if (key === "range") update({ range_start: undefined, range_end: undefined });
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__primary">
        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filter-search">
            Zoeken
          </label>
          <input
            id="filter-search"
            type="search"
            className="input"
            placeholder="Naam, notitie…"
            value={filters.search ?? ""}
            onChange={(event) => update({ search: event.target.value || undefined })}
          />
        </div>

        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="select"
            value={filters.status ?? ""}
            onChange={(event) =>
              update({ status: (event.target.value as BookingStatus) || undefined })
            }
          >
            <option value="">Alle statussen</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filter-entity-type">
            Entiteittype
          </label>
          <select
            id="filter-entity-type"
            className="select"
            value={filters.entity_type_id ?? ""}
            onChange={(event) =>
              update({
                entity_type_id: event.target.value || undefined,
                entity_id: undefined,
                role_definition_id: undefined,
              })
            }
          >
            <option value="">Alle typen</option>
            {entityTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filter-entity">
            Entiteit
          </label>
          <select
            id="filter-entity"
            className="select"
            value={filters.entity_id ?? ""}
            onChange={(event) => update({ entity_id: event.target.value || undefined })}
            disabled={filteredEntities.length === 0}
          >
            <option value="">Alle entiteiten</option>
            {filteredEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filter-role">
            Rol
          </label>
          <select
            id="filter-role"
            className="select"
            value={filters.role_definition_id ?? ""}
            onChange={(event) =>
              update({ role_definition_id: event.target.value || undefined })
            }
          >
            <option value="">Alle rollen</option>
            {filteredRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filter-category">
            Categorie
          </label>
          <select
            id="filter-category"
            className="select"
            value={filters.category_id ?? ""}
            onChange={(event) => update({ category_id: event.target.value || undefined })}
          >
            <option value="">Alle categorieën</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.path.join(" › ")}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-bar__group filter-bar__group--range">
          <label className="filter-bar__label" htmlFor="filter-start">
            Periode
          </label>
          <div className="filter-bar__range">
            <input
              id="filter-start"
              type="date"
              className="input"
              value={isoDate(filters.range_start)}
              onChange={(event) =>
                update({
                  range_start: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : undefined,
                })
              }
            />
            <span>–</span>
            <input
              id="filter-end"
              type="date"
              className="input"
              value={isoDate(filters.range_end)}
              onChange={(event) =>
                update({
                  range_end: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : undefined,
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="filter-bar__actions">
        <div className="view-toggle" role="group" aria-label="Weergave">
          {[
            { key: "calendar", label: "Kalender" },
            { key: "list", label: "Lijst" },
            { key: "availability", label: "Beschikbaar" },
            { key: "occupancy", label: "Bezetting" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`button${activeView === key ? " button--primary" : " button--secondary"}`}
              type="button"
              onClick={() => onViewChange(key as typeof activeView)}
            >
              {label}
            </button>
          ))}
        </div>
        {onExport && (
          <button className="button button--secondary" type="button" onClick={onExport}>
            Export CSV
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="filter-bar__chips" data-testid="active-filters">
          {activeChips.map((chip) => (
            <span key={chip.key} className="chip filter-bar__chip">
              {chip.label}
              <button
                className="filter-bar__chip-remove"
                type="button"
                aria-label={`Verwijder filter ${chip.label}`}
                onClick={() => removeChip(chip.key)}
              >
                ×
              </button>
            </span>
          ))}
          <button className="button button--text" type="button" onClick={onClear}>
            Wis alles
          </button>
        </div>
      )}
    </div>
  );
}
