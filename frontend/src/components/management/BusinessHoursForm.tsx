import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { BusinessHours, BusinessHoursInput } from "../../types/api";
import { Checkbox, FormActions, FormField, TextInput } from "../FormControls";

const DUTCH_DAY_NAMES = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
];

function formatTimeInput(time: string): string {
  // Accepts either "HH:MM" or "HH:MM:SS" and returns "HH:MM".
  const parts = time.split(":");
  return parts.length >= 2 ? `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}` : "";
}

function buildInitialItems(saved: BusinessHours[]): BusinessHoursInput[] {
  const byDay = new Map(saved.map((item) => [item.day_of_week, item]));
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const existing = byDay.get(dayOfWeek);
    return {
      day_of_week: dayOfWeek,
      start_time: existing ? formatTimeInput(existing.start_time) : "09:00",
      end_time: existing ? formatTimeInput(existing.end_time) : "18:00",
      is_closed: existing ? existing.is_closed : dayOfWeek >= 5,
    };
  });
}

function validate(items: BusinessHoursInput[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const item of items) {
    if (item.is_closed) continue;
    if (!item.start_time || !item.end_time) {
      errors[item.day_of_week] = "Vul een openings- en sluitingstijd in.";
      continue;
    }
    if (item.start_time >= item.end_time) {
      errors[item.day_of_week] = "De sluitingstijd moet na de openingstijd liggen.";
    }
  }
  return errors;
}

export function BusinessHoursForm({
  hours,
  saving,
  onSubmit,
  onCancel,
}: {
  hours: BusinessHours[];
  saving: boolean;
  onSubmit: (items: BusinessHoursInput[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<BusinessHoursInput[]>(() => buildInitialItems(hours));
  const [errors, setErrors] = useState<Record<number, string>>({});

  const changed = useMemo(() => {
    const original = buildInitialItems(hours);
    return JSON.stringify(items) !== JSON.stringify(original);
  }, [items, hours]);

  const updateItem = (dayOfWeek: number, patch: Partial<BusinessHoursInput>) => {
    setItems((current) =>
      current.map((item) => (item.day_of_week === dayOfWeek ? { ...item, ...patch } : item)),
    );
    setErrors((current) => {
      const next = { ...current };
      delete next[dayOfWeek];
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validate(items);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    onSubmit(items);
  };

  return (
    <form className="management-form" onSubmit={submit} noValidate>
      {items.map((item) => (
        <div
          key={item.day_of_week}
          className={`form-grid form-grid--3${item.is_closed ? " business-hours--closed" : ""}`}
          style={{ alignItems: "end" }}
        >
          <FormField
            label={DUTCH_DAY_NAMES[item.day_of_week]}
            error={errors[item.day_of_week]}
          >
            <TextInput
              aria-label={`Openingstijd ${DUTCH_DAY_NAMES[item.day_of_week]}`}
              type="time"
              value={item.start_time}
              disabled={item.is_closed || saving}
              onChange={(event) => updateItem(item.day_of_week, { start_time: event.target.value })}
            />
          </FormField>
          <FormField label="Sluitingstijd">
            <TextInput
              aria-label={`Sluitingstijd ${DUTCH_DAY_NAMES[item.day_of_week]}`}
              type="time"
              value={item.end_time}
              disabled={item.is_closed || saving}
              onChange={(event) => updateItem(item.day_of_week, { end_time: event.target.value })}
            />
          </FormField>
          <Checkbox
            label="Gesloten"
            checked={item.is_closed}
            disabled={saving}
            onChange={(event) =>
              updateItem(item.day_of_week, { is_closed: event.target.checked })
            }
          />
        </div>
      ))}
      <FormActions>
        <button className="button button--primary" type="submit" disabled={saving || !changed}>
          Openingstijden opslaan
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Annuleren
        </button>
      </FormActions>
    </form>
  );
}
