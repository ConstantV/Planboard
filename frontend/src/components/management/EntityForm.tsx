import { useState, type FormEvent } from "react";

import type {
  CustomValue,
  Entity,
  EntityCategory,
  EntityInput,
  EntityType,
  FieldDefinition,
} from "../../types/api";
import { Checkbox, FormActions, FormField, SelectInput, TextInput } from "../FormControls";

function initialValues(entity?: Entity): Record<string, string | boolean> {
  if (!entity) return {};
  return Object.fromEntries(
    Object.entries(entity.values).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value ?? "")]),
  );
}

function typedValue(field: FieldDefinition, value: string | boolean | undefined): CustomValue {
  if (field.data_type === "boolean") return Boolean(value);
  if (value === undefined || value === "") return null;
  if (field.data_type === "number") return Number(value);
  return String(value);
}

function DynamicField({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDefinition;
  value: string | boolean | undefined;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  if (field.data_type === "boolean") {
    return (
      <div className="dynamic-checkbox">
        <Checkbox label={field.label} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {error && <small className="field-error">{error}</small>}
      </div>
    );
  }
  if (field.data_type === "select") {
    return (
      <FormField label={field.label} error={error}>
        <SelectInput value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecteer…</option>
          {(field.select_options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </SelectInput>
      </FormField>
    );
  }
  return (
    <FormField label={field.label} error={error}>
      <TextInput
        type={field.data_type === "number" ? "number" : field.data_type === "date" ? "date" : "text"}
        step={field.data_type === "number" ? "any" : undefined}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

export function EntityForm({
  entityTypes,
  categories,
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  entityTypes: EntityType[];
  categories: EntityCategory[];
  initial?: Entity;
  saving: boolean;
  onSubmit: (input: EntityInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [entityTypeId, setEntityTypeId] = useState(initial?.entity_type_id ?? entityTypes[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [useColor, setUseColor] = useState(Boolean(initial?.color));
  const [color, setColor] = useState(initial?.color ?? "#247483");
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const selectedType = entityTypes.find((entityType) => entityType.id === entityTypeId);
  const fields = selectedType?.fields.filter((field) => field.is_active).sort((a, b) => a.display_order - b.display_order) ?? [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Naam is verplicht.";
    if (!selectedType) nextErrors.entityType = "Kies een entiteitType.";
    for (const field of fields) {
      const value = values[field.key];
      if (field.is_required && field.data_type !== "boolean" && (value === undefined || value === "")) {
        nextErrors[field.key] = `${field.label} is verplicht.`;
      }
      if (field.data_type === "number" && value !== undefined && value !== "" && Number.isNaN(Number(value))) {
        nextErrors[field.key] = "Voer een geldig getal in.";
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !selectedType) return;
    await onSubmit({
      name: name.trim(),
      entity_type_id: selectedType.id,
      category_id: categoryId || null,
      color: useColor ? color : null,
      values: Object.fromEntries(fields.map((field) => [field.key, typedValue(field, values[field.key])])),
    });
  };

  return (
    <form className="management-form entity-form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-grid form-grid--2">
        <FormField label="Naam" error={errors.name}>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </FormField>
        <FormField label="EntiteitType" error={errors.entityType}>
          <SelectInput value={entityTypeId} onChange={(event) => {
            setEntityTypeId(event.target.value);
            setValues({});
          }}>
            <option value="">Selecteer…</option>
            {entityTypes.map((entityType) => <option key={entityType.id} value={entityType.id}>{entityType.name}</option>)}
          </SelectInput>
        </FormField>
        <FormField label="Categorie">
          <SelectInput value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Geen categorie</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.path.join(" › ")}</option>)}
          </SelectInput>
        </FormField>
        <div className="color-field">
          <Checkbox label="Eigen kalenderkleur" checked={useColor} onChange={(event) => setUseColor(event.target.checked)} />
          <input aria-label="Entiteitkleur" type="color" value={color} disabled={!useColor} onChange={(event) => setColor(event.target.value)} />
        </div>
      </div>

      {selectedType && (
        <fieldset className="dynamic-fields">
          <legend>{selectedType.name}-eigenschappen</legend>
          <div className="form-grid form-grid--2">
            {fields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={values[field.key]}
                error={errors[field.key]}
                onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
          </div>
          {fields.length === 0 && <p className="muted-copy">Dit type heeft geen extra velden.</p>}
        </fieldset>
      )}

      <FormActions>
        <button className="button button--ghost" type="button" onClick={onCancel}>Annuleren</button>
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? "Opslaan…" : initial ? "Entiteit bijwerken" : "Entiteit aanmaken"}</button>
      </FormActions>
    </form>
  );
}
