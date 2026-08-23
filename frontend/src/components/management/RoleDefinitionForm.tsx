import { useState, type FormEvent } from "react";

import type { RoleDefinition, RoleDefinitionInput } from "../../types/api";
import { Checkbox, FormActions, FormField, TextInput } from "../FormControls";

export function RoleDefinitionForm({
  entityTypeId,
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  entityTypeId: string;
  initial?: RoleDefinition;
  saving: boolean;
  onSubmit: (input: RoleDefinitionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [scope, setScope] = useState(initial?.booking_scope ?? "default");
  const [required, setRequired] = useState(initial?.is_required ?? false);
  const [multiple, setMultiple] = useState(initial?.allow_multiple ?? false);
  const [exclusive, setExclusive] = useState(initial?.is_exclusive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^[a-z][a-z0-9_]*$/.test(key)) nextErrors.key = "Gebruik een geldige sleutel.";
    if (!label.trim()) nextErrors.label = "Label is verplicht.";
    if (!/^[a-z][a-z0-9_]*$/.test(scope)) nextErrors.scope = "Gebruik een geldige scope.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit({
      key,
      label: label.trim(),
      booking_scope: scope,
      entity_type_id: entityTypeId,
      is_required: required,
      allow_multiple: multiple,
      is_exclusive: exclusive,
      display_order: initial?.display_order ?? 0,
    });
  };

  return (
    <form className="management-form management-form--nested" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-grid form-grid--3">
        <FormField label="Rolnaam" error={errors.label}>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
        </FormField>
        <FormField label="Technische sleutel" error={errors.key}>
          <TextInput value={key} onChange={(event) => setKey(event.target.value)} />
        </FormField>
        <FormField label="Booking-scope" error={errors.scope}>
          <TextInput value={scope} onChange={(event) => setScope(event.target.value)} />
        </FormField>
      </div>
      <div className="checkbox-row">
        <Checkbox label="Verplicht in scope" checked={required} onChange={(event) => setRequired(event.target.checked)} />
        <Checkbox label="Meerdere toegestaan" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} />
        <Checkbox label="Blokkeert tijd" checked={exclusive} onChange={(event) => setExclusive(event.target.checked)} />
      </div>
      <FormActions>
        <button className="button button--ghost" type="button" onClick={onCancel}>Annuleren</button>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? "Opslaan…" : initial ? "Rol bijwerken" : "Rol toevoegen"}
        </button>
      </FormActions>
    </form>
  );
}
