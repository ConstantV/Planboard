import { useCallback, useState } from "react";

import {
  createBookingType,
  deactivateBookingType,
  listBookingTypes,
  updateBookingType,
} from "../api/bookingTypes";
import { listBusinessHours, updateBusinessHours } from "../api/businessHours";
import {
  createEntityType,
  createFieldDefinition,
  createRoleDefinition,
  deactivateEntityType,
  deactivateFieldDefinition,
  deactivateRoleDefinition,
  installPreset,
  listEntityTypes,
  listRoleDefinitions,
  updateEntityType,
  updateFieldDefinition,
  updateRoleDefinition,
} from "../api/configuration";
import { MutationFeedback } from "../components/MutationFeedback";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { BookingTypeForm } from "../components/management/BookingTypeForm";
import { BusinessHoursForm } from "../components/management/BusinessHoursForm";
import { EntityTypeForm } from "../components/management/EntityTypeForm";
import { FieldDefinitionForm } from "../components/management/FieldDefinitionForm";
import { RoleDefinitionForm } from "../components/management/RoleDefinitionForm";
import { useApiResource } from "../hooks/useApiResource";
import { useMutationFeedback } from "../hooks/useMutationFeedback";
import type {
  BookingType,
  BookingTypeInput,
  BusinessHoursInput,
  EntityTypeInput,
  FieldDefinition,
  FieldDefinitionInput,
  RoleDefinition,
  RoleDefinitionInput,
} from "../types/api";

type PresetKey = "hair_salon" | "rental" | "repair_workshop";

const presets: { key: PresetKey; name: string; description: string }[] = [
  { key: "hair_salon", name: "Kapperszaak", description: "Klant, kapster en stoel" },
  { key: "rental", name: "Verhuur", description: "Klant, artikel en medewerker" },
  { key: "repair_workshop", name: "Werkplaats", description: "Werkstuk, monteur en werkbank" },
];

export function ConfigurationPage() {
  const loader = useCallback(async () => {
    const [entityTypes, roles, bookingTypes, businessHours] = await Promise.all([
      listEntityTypes(),
      listRoleDefinitions(),
      listBookingTypes(undefined, true),
      listBusinessHours(),
    ]);
    return { entityTypes, roles, bookingTypes, businessHours };
  }, []);
  const { data, error, loading, reload } = useApiResource(loader);
  const mutation = useMutationFeedback();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [showTypeForm, setShowTypeForm] = useState<"create" | "edit" | null>(null);
  const [editingField, setEditingField] = useState<FieldDefinition | "new" | null>(null);
  const [editingRole, setEditingRole] = useState<RoleDefinition | "new" | null>(null);
  const [editingBookingType, setEditingBookingType] = useState<BookingType | "new" | null>(null);
  const [editingBusinessHours, setEditingBusinessHours] = useState(false);

  const selectedType =
    data?.entityTypes.find((entityType) => entityType.id === selectedTypeId) ??
    data?.entityTypes[0];

  const mutate = async <T,>(operation: () => Promise<T>, message: string) => {
    const result = await mutation.run(operation, message);
    if (result !== null) await reload();
    return result;
  };

  const saveType = async (input: EntityTypeInput) => {
    const result = await mutate(
      () => selectedType && showTypeForm === "edit"
        ? updateEntityType(selectedType.id, input)
        : createEntityType(input),
      selectedType && showTypeForm === "edit" ? "EntiteitType bijgewerkt." : "EntiteitType aangemaakt.",
    );
    if (result) {
      setSelectedTypeId(result.id);
      setShowTypeForm(null);
    }
  };

  const saveField = async (input: FieldDefinitionInput) => {
    if (!selectedType) return;
    const result = await mutate(
      () => editingField && editingField !== "new"
        ? updateFieldDefinition(editingField.id, input)
        : createFieldDefinition(selectedType.id, input),
      editingField === "new" ? "Veld toegevoegd." : "Veld bijgewerkt.",
    );
    if (result) setEditingField(null);
  };

  const saveRole = async (input: RoleDefinitionInput) => {
    const result = await mutate(
      () => editingRole && editingRole !== "new"
        ? updateRoleDefinition(editingRole.id, input)
        : createRoleDefinition(input),
      editingRole === "new" ? "Planningrol toegevoegd." : "Planningrol bijgewerkt.",
    );
    if (result) setEditingRole(null);
  };

  const saveBookingType = async (input: BookingTypeInput) => {
    const result = await mutate(
      () => editingBookingType && editingBookingType !== "new"
        ? updateBookingType(editingBookingType.id, input)
        : createBookingType(input),
      editingBookingType === "new" ? "Afspraaktype toegevoegd." : "Afspraaktype bijgewerkt.",
    );
    if (result) setEditingBookingType(null);
  };

  const saveBusinessHours = async (input: BusinessHoursInput[]) => {
    const result = await mutate(() => updateBusinessHours(input), "Openingstijden bijgewerkt.");
    if (result) setEditingBusinessHours(false);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Beheer"
        title="Configuratie"
        description="Installeer een startpreset of configureer typen, velden en planningrollen zelf."
        actions={
          <button className="button button--primary" type="button" onClick={() => setShowTypeForm("create")}>
            Nieuw entiteitType
          </button>
        }
      />
      <MutationFeedback error={mutation.error} notice={mutation.notice} />
      {loading && <LoadingState label="Configuratie laden…" />}
      {error && <ErrorState error={error} onRetry={() => void reload()} />}
      {data && (
        <div className="configuration-layout">
          <aside className="management-sidebar panel">
            <div className="section-heading">
              <div><p className="eyebrow">Startpunt</p><h2>Branchepresets</h2></div>
            </div>
            <div className="preset-list">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  className="preset-card"
                  type="button"
                  disabled={mutation.saving}
                  onClick={() => void mutate(() => installPreset(preset.key), `${preset.name}-preset geïnstalleerd.`)}
                >
                  <strong>{preset.name}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>

            <div className="section-heading section-heading--spaced">
              <div><p className="eyebrow">Structuur</p><h2>Entiteittypen</h2></div>
              <span className="count-badge">{data.entityTypes.length}</span>
            </div>
            <div className="selection-list" role="list">
              {data.entityTypes.map((entityType) => (
                <button
                  key={entityType.id}
                  className={`selection-item${selectedType?.id === entityType.id ? " selection-item--active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedTypeId(entityType.id);
                    setShowTypeForm(null);
                    setEditingField(null);
                    setEditingRole(null);
                  }}
                >
                  <span className="color-dot" style={{ backgroundColor: entityType.color ?? "#d9e1df" }} />
                  <span><strong>{entityType.name}</strong><small>{entityType.key}</small></span>
                </button>
              ))}
            </div>
          </aside>

          <section className="management-content">
            <div className="panel editor-panel">
              <div className="section-heading">
                <div><p className="eyebrow">Planning</p><h2>Openingstijden</h2></div>
                {!editingBusinessHours && (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setEditingBusinessHours(true)}
                  >
                    Bewerken
                  </button>
                )}
              </div>
              {editingBusinessHours ? (
                <BusinessHoursForm
                  hours={data.businessHours}
                  saving={mutation.saving}
                  onSubmit={(input) => void saveBusinessHours(input)}
                  onCancel={() => setEditingBusinessHours(false)}
                />
              ) : (
                <ul className="definition-list">
                  {data.businessHours
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((item) => (
                      <li key={item.id} className="definition-row">
                        <div>
                          <strong>{
                            ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][
                              item.day_of_week
                            ]
                          }</strong>
                        </div>
                        <div className="chip-row">
                          {item.is_closed ? (
                            <span className="chip">Gesloten</span>
                          ) : (
                            <span className="chip">{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {showTypeForm === "create" && (
              <div className="panel editor-panel">
                <div className="section-heading"><div><p className="eyebrow">Nieuw</p><h2>EntiteitType aanmaken</h2></div></div>
                <EntityTypeForm saving={mutation.saving} onSubmit={saveType} onCancel={() => setShowTypeForm(null)} />
              </div>
            )}

            {!selectedType && showTypeForm !== "create" && (
              <EmptyState title="Nog geen configuratie">
                Installeer een branchepreset of maak je eerste entiteitType aan.
              </EmptyState>
            )}

            {selectedType && showTypeForm !== "create" && (
              <>
                <div className="panel editor-panel">
                  <div className="section-heading">
                    <div><p className="eyebrow">EntiteitType</p><h2>{selectedType.name}</h2><p>{selectedType.key}</p></div>
                    <div className="row-actions">
                      <button className="button button--secondary" type="button" onClick={() => setShowTypeForm(showTypeForm === "edit" ? null : "edit")}>Bewerken</button>
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => {
                          if (window.confirm(`EntiteitType “${selectedType.name}” archiveren?`)) {
                            void mutate(() => deactivateEntityType(selectedType.id), "EntiteitType gearchiveerd.").then((result) => {
                              if (result) setSelectedTypeId(null);
                            });
                          }
                        }}
                      >Archiveren</button>
                    </div>
                  </div>
                  {showTypeForm === "edit" && (
                    <EntityTypeForm key={selectedType.updated_at} initial={selectedType} saving={mutation.saving} onSubmit={saveType} onCancel={() => setShowTypeForm(null)} />
                  )}
                </div>

                <div className="panel editor-panel">
                  <div className="section-heading">
                    <div><p className="eyebrow">Eigenschappen</p><h2>Configureerbare velden</h2></div>
                    <button className="button button--secondary" type="button" onClick={() => setEditingField("new")}>Veld toevoegen</button>
                  </div>
                  {editingField && (
                    <FieldDefinitionForm
                      key={editingField === "new" ? "new" : editingField.id + editingField.updated_at}
                      initial={editingField === "new" ? undefined : editingField}
                      saving={mutation.saving}
                      onSubmit={saveField}
                      onCancel={() => setEditingField(null)}
                    />
                  )}
                  <div className="definition-list">
                    {selectedType.fields.filter((field) => field.is_active).map((field) => (
                      <article key={field.id} className="definition-row">
                        <div><strong>{field.label}</strong><small>{field.key} · {field.data_type}</small></div>
                        <div className="chip-row">
                          {field.is_required && <span className="chip">verplicht</span>}
                          {field.is_searchable && <span className="chip">zoeken</span>}
                          {field.is_filterable && <span className="chip">filteren</span>}
                        </div>
                        <div className="row-actions">
                          <button className="icon-button" type="button" aria-label={`${field.label} bewerken`} onClick={() => setEditingField(field)}>Bewerk</button>
                          <button className="icon-button icon-button--danger" type="button" aria-label={`${field.label} archiveren`} onClick={() => {
                            if (window.confirm(`Veld “${field.label}” archiveren?`)) void mutate(() => deactivateFieldDefinition(field.id), "Veld gearchiveerd.");
                          }}>Archiveer</button>
                        </div>
                      </article>
                    ))}
                    {selectedType.fields.filter((field) => field.is_active).length === 0 && <p className="muted-copy">Nog geen configureerbare velden.</p>}
                  </div>
                </div>

                <div className="panel editor-panel">
                  <div className="section-heading">
                    <div><p className="eyebrow">Planning</p><h2>Rollen en exclusiviteit</h2></div>
                    <button className="button button--secondary" type="button" onClick={() => setEditingRole("new")}>Rol toevoegen</button>
                  </div>
                  {editingRole && (
                    <RoleDefinitionForm
                      key={editingRole === "new" ? "new" : editingRole.id + editingRole.updated_at}
                      entityTypeId={selectedType.id}
                      initial={editingRole === "new" ? undefined : editingRole}
                      saving={mutation.saving}
                      onSubmit={saveRole}
                      onCancel={() => setEditingRole(null)}
                    />
                  )}
                  <div className="definition-list">
                    {data.roles.filter((role) => role.entity_type_id === selectedType.id).map((role) => (
                      <article key={role.id} className="definition-row">
                        <div><strong>{role.label}</strong><small>{role.key} · {role.booking_scope}</small></div>
                        <div className="chip-row">
                          {role.is_required && <span className="chip">verplicht</span>}
                          {role.allow_multiple && <span className="chip">meerdere</span>}
                          <span className={`chip${role.is_exclusive ? " chip--accent" : ""}`}>{role.is_exclusive ? "blokkeert tijd" : "niet exclusief"}</span>
                        </div>
                        <div className="row-actions">
                          <button className="icon-button" type="button" aria-label={`${role.label} bewerken`} onClick={() => setEditingRole(role)}>Bewerk</button>
                          <button className="icon-button icon-button--danger" type="button" aria-label={`${role.label} archiveren`} onClick={() => {
                            if (window.confirm(`Rol “${role.label}” archiveren?`)) void mutate(() => deactivateRoleDefinition(role.id), "Rol gearchiveerd.");
                          }}>Archiveer</button>
                        </div>
                      </article>
                    ))}
                    {data.roles.filter((role) => role.entity_type_id === selectedType.id).length === 0 && <p className="muted-copy">Nog geen planningrollen.</p>}
                  </div>
                </div>
              </>
            )}

            {showTypeForm !== "create" && (
              <div className="panel editor-panel">
                <div className="section-heading">
                  <div><p className="eyebrow">Planning</p><h2>Afspraaktypen en duurregels</h2></div>
                  <button className="button button--secondary" type="button" onClick={() => setEditingBookingType("new")}>Type toevoegen</button>
                </div>
                {editingBookingType && (
                  <BookingTypeForm
                    key={editingBookingType === "new" ? "new" : editingBookingType.id + editingBookingType.updated_at}
                    initial={editingBookingType === "new" ? undefined : editingBookingType}
                    scopes={[...new Set([
                      ...data.roles.map((role) => role.booking_scope),
                      ...data.bookingTypes.map((type) => type.booking_scope),
                    ])].sort()}
                    saving={mutation.saving}
                    onSubmit={saveBookingType}
                    onCancel={() => setEditingBookingType(null)}
                  />
                )}
                <div className="definition-list">
                  {data.bookingTypes.filter((type) => type.is_active).map((type) => (
                    <article key={type.id} className="definition-row">
                      <div><strong>{type.name}</strong><small>{type.key} · {type.booking_scope}</small></div>
                      <div className="chip-row">
                        {type.default_duration_minutes != null && <span className="chip">{type.default_duration_minutes} min</span>}
                        <span className={`chip${type.duration_mode === "fixed" ? " chip--accent" : ""}`}>
                          {type.duration_mode === "fixed" ? "vaste duur" : "voorgestelde duur"}
                        </span>
                      </div>
                      <div className="row-actions">
                        <button className="icon-button" type="button" aria-label={`${type.name} bewerken`} onClick={() => setEditingBookingType(type)}>Bewerk</button>
                        <button className="icon-button icon-button--danger" type="button" aria-label={`${type.name} archiveren`} onClick={() => {
                          if (window.confirm(`Afspraaktype “${type.name}” archiveren?`)) void mutate(() => deactivateBookingType(type.id), "Afspraaktype gearchiveerd.");
                        }}>Archiveer</button>
                      </div>
                    </article>
                  ))}
                  {data.bookingTypes.filter((type) => type.is_active).length === 0 && <p className="muted-copy">Nog geen afspraaktypen. De branchepresets leveren een starterszet.</p>}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
