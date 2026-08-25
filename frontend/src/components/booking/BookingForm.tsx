import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { ApiError } from "../../api/client";
import type {
  Booking,
  BookingConflict,
  BookingInput,
  BookingType,
  Entity,
  RoleDefinition,
} from "../../types/api";
import {
  buildBookingInput,
  patchBookingFormValues,
  scopeBookingFormValues,
  type BookingFormValues,
  validateBookingFormValues,
} from "./booking-form";
import {
  FormActions,
  FormField,
  SelectInput,
  TextInput,
} from "../FormControls";

export type { BookingFormValues } from "./booking-form";

export interface BookingFormProps {
  values: BookingFormValues;
  booking?: Booking;
  roles: RoleDefinition[];
  bookingTypes: BookingType[];
  entities: Entity[];
  error: ApiError | null;
  saving: boolean;
  onChange: (values: BookingFormValues) => void;
  onSubmit: (input: BookingInput) => void;
  onCancel: () => void;
}

export function BookingForm({
  values,
  booking,
  roles,
  bookingTypes,
  entities,
  error,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: BookingFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scopes = useMemo(
    () => [...new Set(roles.map((role) => role.booking_scope))].sort(),
    [roles],
  );
  const scopeRoles = useMemo(
    () =>
      roles
        .filter((role) => role.booking_scope === values.scope)
        .sort((a, b) => a.display_order - b.display_order),
    [roles, values.scope],
  );
  const scopeBookingTypes = useMemo(
    () => bookingTypes.filter((type) => type.booking_scope === values.scope),
    [bookingTypes, values.scope],
  );
  const selectedType = scopeBookingTypes.find((type) => type.id === values.bookingTypeId);
  const isFixed = selectedType?.duration_mode === "fixed";

  const patch = (changes: Partial<BookingFormValues>) => {
    onChange(patchBookingFormValues(values, changes, bookingTypes));
    setErrors({});
  };

  const changeScope = (scope: string) => {
    onChange(scopeBookingFormValues(values, scope, bookingTypes));
    setErrors({});
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validateBookingFormValues(values, scopeRoles, selectedType);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    onSubmit(buildBookingInput(values, scopeRoles));
  };

  const conflicts =
    error?.kind === "conflict" && Array.isArray(error.details)
      ? (error.details as BookingConflict[])
      : [];

  return (
    <form className="form" onSubmit={submit} noValidate>
      {error && (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <strong>
            {error.kind === "conflict"
              ? "Tijdslot bezet"
              : error.kind === "validation"
                ? "Controleer de gegevens"
                : "Opslaan mislukt"}
          </strong>
          <span>{error.message}</span>
          {conflicts.length > 0 && (
            <ul>
              {conflicts.map((conflict) => (
                <li key={`${conflict.entity_id}-${conflict.conflicting_role_key}`}>
                  {conflict.entity_name} ({conflict.conflicting_role_key}) is geboekt van{" "}
                  {new Date(conflict.start_at).toLocaleString("nl-NL")} tot{" "}
                  {new Date(conflict.end_at).toLocaleString("nl-NL")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <FormField label="Workflow" error={errors.scope}>
        <SelectInput
          aria-label="Workflow"
          value={values.scope}
          onChange={(event) => changeScope(event.target.value)}
        >
          <option value="">Kies een workflow…</option>
          {scopes.map((scope) => (
            <option key={scope} value={scope}>
              {scope}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {scopeBookingTypes.length > 0 && (
        <FormField
          label="Afspraaktype"
          hint={
            selectedType?.default_duration_minutes
              ? isFixed
                ? `Vaste duur: ${selectedType.default_duration_minutes} minuten`
                : `Voorgestelde duur: ${selectedType.default_duration_minutes} minuten`
              : undefined
          }
        >
          <SelectInput
            aria-label="Afspraaktype"
            value={values.bookingTypeId}
            onChange={(event) => patch({ bookingTypeId: event.target.value })}
          >
            <option value="">Geen type</option>
            {scopeBookingTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </SelectInput>
        </FormField>
      )}

      <div className="form-grid form-grid--2">
        <FormField label="Start" error={errors.start}>
          <TextInput
            aria-label="Start"
            type="datetime-local"
            value={values.start}
            onChange={(event) => patch({ start: event.target.value })}
          />
        </FormField>
        <FormField label="Einde" error={errors.end}>
          <TextInput
            aria-label="Einde"
            type="datetime-local"
            value={values.end}
            disabled={isFixed && selectedType?.default_duration_minutes != null}
            onChange={(event) => patch({ end: event.target.value })}
          />
        </FormField>
      </div>

      <FormField label="Status">
        <SelectInput
          aria-label="Status"
          value={values.status}
          onChange={(event) => patch({ status: event.target.value as BookingFormValues["status"] })}
        >
          <option value="confirmed">Bevestigd</option>
          <option value="tentative">Voorlopig</option>
          <option value="cancelled">Geannuleerd</option>
        </SelectInput>
      </FormField>

      {scopeRoles.map((role) => {
        const options = entities.filter((entity) => entity.entity_type_id === role.entity_type_id);
        return (
          <FormField
            key={role.id}
            label={`${role.label}${role.is_required ? " *" : ""}`}
            error={errors[`role-${role.id}`]}
            hint={role.allow_multiple ? "Meerdere keuzes mogelijk" : undefined}
          >
            <SelectInput
              aria-label={role.label}
              multiple={role.allow_multiple}
              size={role.allow_multiple ? Math.min(Math.max(options.length, 2), 5) : undefined}
              value={role.allow_multiple ? (values.selections[role.id] ?? []) : (values.selections[role.id]?.[0] ?? "")}
              onChange={(event) => {
                const selected = role.allow_multiple
                  ? [...event.target.selectedOptions].map((option) => option.value)
                  : event.target.value
                    ? [event.target.value]
                    : [];
                patch({ selections: { ...values.selections, [role.id]: selected } });
              }}
            >
              {!role.allow_multiple && <option value="">Kies {role.label.toLowerCase()}…</option>}
              {options.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </SelectInput>
            {options.length === 0 && (
              <small>Maak eerst {role.label.toLowerCase()}-entiteiten aan op de Entiteiten-pagina.</small>
            )}
          </FormField>
        );
      })}

      <FormField label="Notities">
        <textarea
          className="input"
          aria-label="Notities"
          rows={3}
          value={values.notes}
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </FormField>

      <FormActions>
        <button className="button button--primary" type="submit" disabled={saving}>
          {booking ? "Booking bijwerken" : "Booking aanmaken"}
        </button>
        <button className="button button--secondary" type="button" disabled={saving} onClick={onCancel}>
          Annuleren
        </button>
      </FormActions>
    </form>
  );
}
