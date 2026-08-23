import { useState, type FormEvent } from "react";

import type { EntityType, EntityTypeInput } from "../../types/api";
import { Checkbox, FormActions, FormField, TextInput } from "../FormControls";

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function EntityTypeForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: EntityType;
  saving: boolean;
  onSubmit: (input: EntityTypeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [useColor, setUseColor] = useState(Boolean(initial?.color));
  const [color, setColor] = useState(initial?.color ?? "#247483");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Naam is verplicht.";
    if (!KEY_PATTERN.test(key)) nextErrors.key = "Gebruik kleine letters, cijfers en underscores.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit({ name: name.trim(), key, color: useColor ? color : null });
  };

  return (
    <form className="management-form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-grid form-grid--3">
        <FormField label="Naam" error={errors.name}>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </FormField>
        <FormField label="Technische sleutel" error={errors.key} hint="Bijvoorbeeld rental_item">
          <TextInput value={key} onChange={(event) => setKey(event.target.value)} />
        </FormField>
        <div className="color-field">
          <Checkbox
            label="Standaardkleur gebruiken"
            checked={useColor}
            onChange={(event) => setUseColor(event.target.checked)}
          />
          <input
            aria-label="Standaardkleur"
            type="color"
            value={color}
            disabled={!useColor}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
      </div>
      <FormActions>
        <button className="button button--ghost" type="button" onClick={onCancel}>
          Annuleren
        </button>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? "Opslaan…" : initial ? "Wijzigingen opslaan" : "Type aanmaken"}
        </button>
      </FormActions>
    </form>
  );
}
