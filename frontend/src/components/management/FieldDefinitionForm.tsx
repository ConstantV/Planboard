import { useState, type FormEvent } from "react";

import type { FieldDataType, FieldDefinition, FieldDefinitionInput } from "../../types/api";
import { Checkbox, FormActions, FormField, SelectInput, TextInput } from "../FormControls";

const dataTypes: { value: FieldDataType; label: string }[] = [
  { value: "text", label: "Tekst" },
  { value: "number", label: "Getal" },
  { value: "boolean", label: "Ja/nee" },
  { value: "date", label: "Datum" },
  { value: "select", label: "Keuzelijst" },
];

export function FieldDefinitionForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: FieldDefinition;
  saving: boolean;
  onSubmit: (input: FieldDefinitionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [dataType, setDataType] = useState<FieldDataType>(initial?.data_type ?? "text");
  const [required, setRequired] = useState(initial?.is_required ?? false);
  const [searchable, setSearchable] = useState(initial?.is_searchable ?? false);
  const [filterable, setFilterable] = useState(initial?.is_filterable ?? false);
  const [options, setOptions] = useState(initial?.select_options?.join(", ") ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!/^[a-z][a-z0-9_]*$/.test(key)) nextErrors.key = "Gebruik een geldige sleutel.";
    if (!label.trim()) nextErrors.label = "Label is verplicht.";
    const selectOptions = options.split(",").map((option) => option.trim()).filter(Boolean);
    if (dataType === "select" && selectOptions.length === 0) {
      nextErrors.options = "Voeg minimaal één keuze toe.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit({
      key,
      label: label.trim(),
      data_type: dataType,
      is_required: required,
      is_searchable: searchable,
      is_filterable: filterable,
      display_order: initial?.display_order ?? 0,
      select_options: dataType === "select" ? selectOptions : null,
    });
  };

  return (
    <form className="management-form management-form--nested" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-grid form-grid--3">
        <FormField label="Veldlabel" error={errors.label}>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
        </FormField>
        <FormField label="Technische sleutel" error={errors.key}>
          <TextInput value={key} onChange={(event) => setKey(event.target.value)} />
        </FormField>
        <FormField label="Datatype">
          <SelectInput value={dataType} onChange={(event) => setDataType(event.target.value as FieldDataType)}>
            {dataTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </SelectInput>
        </FormField>
      </div>
      {dataType === "select" && (
        <FormField label="Keuzes" error={errors.options} hint="Gescheiden door komma’s">
          <TextInput value={options} onChange={(event) => setOptions(event.target.value)} />
        </FormField>
      )}
      <div className="checkbox-row">
        <Checkbox label="Verplicht" checked={required} onChange={(event) => setRequired(event.target.checked)} />
        <Checkbox label="Doorzoekbaar" checked={searchable} onChange={(event) => setSearchable(event.target.checked)} />
        <Checkbox label="Filterbaar" checked={filterable} onChange={(event) => setFilterable(event.target.checked)} />
      </div>
      <FormActions>
        <button className="button button--ghost" type="button" onClick={onCancel}>Annuleren</button>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? "Opslaan…" : initial ? "Veld bijwerken" : "Veld toevoegen"}
        </button>
      </FormActions>
    </form>
  );
}
