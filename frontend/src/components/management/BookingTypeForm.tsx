import { useState, type FormEvent } from "react";

import type { BookingType, BookingTypeInput, DurationMode } from "../../types/api";
import { FormActions, FormField, SelectInput, TextInput } from "../FormControls";

export function BookingTypeForm({
  initial,
  scopes,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: BookingType;
  scopes: string[];
  saving: boolean;
  onSubmit: (input: BookingTypeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [scope, setScope] = useState(initial?.booking_scope ?? "default");
  const [duration, setDuration] = useState(
    initial?.default_duration_minutes?.toString() ?? "",
  );
  const [mode, setMode] = useState<DurationMode>(initial?.duration_mode ?? "suggested");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^[a-z][a-z0-9_]*$/.test(key)) nextErrors.key = "Gebruik een geldige sleutel.";
    if (!name.trim()) nextErrors.name = "Naam is verplicht.";
    if (!/^[a-z][a-z0-9_]*$/.test(scope)) nextErrors.scope = "Gebruik een geldige scope.";
    const minutes = duration.trim() ? Number(duration) : null;
    if (duration.trim() && (!Number.isInteger(minutes) || (minutes ?? 0) <= 0)) {
      nextErrors.duration = "Voer een positief aantal minuten in.";
    }
    if (mode === "fixed" && minutes === null) {
      nextErrors.duration = "Een vaste duur vereist een aantal minuten.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit({
      key,
      name: name.trim(),
      booking_scope: scope,
      default_duration_minutes: minutes,
      duration_mode: mode,
    });
  };

  return (
    <form
      className="management-form management-form--nested"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <div className="form-grid form-grid--3">
        <FormField label="Naam" error={errors.name}>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </FormField>
        <FormField label="Technische sleutel" error={errors.key}>
          <TextInput value={key} onChange={(event) => setKey(event.target.value)} />
        </FormField>
        <FormField label="Booking-scope" error={errors.scope}>
          <TextInput
            value={scope}
            list="booking-type-scopes"
            onChange={(event) => setScope(event.target.value)}
          />
          <datalist id="booking-type-scopes">
            {scopes.map((knownScope) => (
              <option key={knownScope} value={knownScope} />
            ))}
          </datalist>
        </FormField>
      </div>
      <div className="form-grid form-grid--2">
        <FormField
          label="Standaardduur (minuten)"
          error={errors.duration}
          hint="Leeg laten als er geen standaardduur is."
        >
          <TextInput
            type="number"
            min={1}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </FormField>
        <FormField label="Duurmodus">
          <SelectInput
            value={mode}
            onChange={(event) => setMode(event.target.value as DurationMode)}
          >
            <option value="suggested">Voorgesteld (aanpasbaar bij plannen)</option>
            <option value="fixed">Vast (niet aanpasbaar)</option>
          </SelectInput>
        </FormField>
      </div>
      <FormActions>
        <button className="button button--ghost" type="button" onClick={onCancel}>
          Annuleren
        </button>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? "Opslaan…" : initial ? "Afspraaktype bijwerken" : "Afspraaktype toevoegen"}
        </button>
      </FormActions>
    </form>
  );
}
