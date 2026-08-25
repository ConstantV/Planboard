import type { EntityType } from "../../types/api";

interface ColorLegendProps {
  entityTypes: EntityType[];
}

export function ColorLegend({ entityTypes }: ColorLegendProps) {
  const activeTypes = entityTypes.filter((type) => type.is_active && type.color);
  if (activeTypes.length === 0) return null;

  return (
    <div className="panel color-legend" role="region" aria-label="Legenda entiteittypen">
      <strong className="color-legend__title">Legenda</strong>
      <ul className="color-legend__list">
        {activeTypes.map((type) => (
          <li key={type.id} className="color-legend__item">
            <span
              className="color-dot color-legend__dot"
              style={{ backgroundColor: type.color ?? undefined }}
              aria-hidden="true"
            />
            <span>{type.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
