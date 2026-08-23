import { useCallback, useState, type FormEvent } from "react";

import { listEntityTypes } from "../api/configuration";
import { createEntity, deactivateEntity, listCategories, listEntities, updateEntity } from "../api/entities";
import { Checkbox, FormField, SelectInput, TextInput } from "../components/FormControls";
import { MutationFeedback } from "../components/MutationFeedback";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { CategoryManager } from "../components/management/CategoryManager";
import { EntityForm } from "../components/management/EntityForm";
import { useApiResource } from "../hooks/useApiResource";
import { useMutationFeedback } from "../hooks/useMutationFeedback";
import type { CustomValue, Entity, FieldDefinition } from "../types/api";

function filterValue(field: FieldDefinition, value: string | boolean): CustomValue {
  if (field.data_type === "boolean") return Boolean(value);
  if (field.data_type === "number") return Number(value);
  return String(value);
}

export function EntitiesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [customFilters, setCustomFilters] = useState<Record<string, string | boolean>>({});
  const [editing, setEditing] = useState<Entity | "new" | null>(null);

  const loader = useCallback(async () => {
    const [entityTypes, categories] = await Promise.all([listEntityTypes(), listCategories()]);
    const selectedType = entityTypes.find((entityType) => entityType.id === typeFilter);
    const configuredFilters = Object.fromEntries(
      Object.entries(customFilters)
        .filter(([, value]) => value !== "")
        .map(([key, value]) => {
          const field = selectedType?.fields.find((definition) => definition.key === key);
          return [key, field ? filterValue(field, value) : value];
        }),
    );
    const entities = await listEntities({
      entity_type_id: typeFilter || undefined,
      category_id: categoryFilter || undefined,
      search: search || undefined,
      filters: Object.keys(configuredFilters).length ? configuredFilters : undefined,
      include_inactive: includeInactive,
    });
    return { entities, entityTypes, categories };
  }, [categoryFilter, customFilters, includeInactive, search, typeFilter]);
  const { data, error, loading, reload } = useApiResource(loader);
  const mutation = useMutationFeedback();
  const selectedFilterType = data?.entityTypes.find((entityType) => entityType.id === typeFilter);
  const filterFields = selectedFilterType?.fields.filter((field) => field.is_active && field.is_filterable) ?? [];

  const mutate = async (operation: () => Promise<unknown>, message: string) => {
    const result = await mutation.run(operation, message);
    if (result !== null) await reload();
    return result !== null;
  };

  const saveEntity = async (input: Parameters<typeof createEntity>[0]) => {
    const success = await mutate(
      () => editing && editing !== "new" ? updateEntity(editing.id, input) : createEntity(input),
      editing === "new" ? "Entiteit aangemaakt." : "Entiteit bijgewerkt.",
    );
    if (success) setEditing(null);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Stamgegevens"
        title="Entiteiten"
        description="Beheer klanten, medewerkers, objecten en resources met formulieren uit hun velddefinities."
        actions={<button className="button button--primary" type="button" onClick={() => setEditing("new")}>Nieuwe entiteit</button>}
      />
      <MutationFeedback error={mutation.error} notice={mutation.notice} />

      {data && (
        <form className="filter-bar" onSubmit={submitSearch} aria-label="Entiteiten filteren">
          <FormField label="Zoeken">
            <TextInput value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Naam of doorzoekbaar veld" />
          </FormField>
          <FormField label="EntiteitType">
            <SelectInput value={typeFilter} onChange={(event) => {
              setTypeFilter(event.target.value);
              setCustomFilters({});
            }}>
              <option value="">Alle typen</option>
              {data.entityTypes.map((entityType) => <option key={entityType.id} value={entityType.id}>{entityType.name}</option>)}
            </SelectInput>
          </FormField>
          <FormField label="Categorie">
            <SelectInput value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Alle categorieën</option>
              {data.categories.map((category) => <option key={category.id} value={category.id}>{category.path.join(" › ")}</option>)}
            </SelectInput>
          </FormField>
          <button className="button button--secondary filter-submit" type="submit">Zoeken</button>
          <Checkbox label="Toon archief" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
        </form>
      )}

      {data && filterFields.length > 0 && (
        <div className="custom-filter-bar" aria-label="Configureerbare filters">
          {filterFields.map((field) => (
            <FormField key={field.id} label={field.label}>
              {field.data_type === "select" ? (
                <SelectInput value={String(customFilters[field.key] ?? "")} onChange={(event) => setCustomFilters((current) => ({ ...current, [field.key]: event.target.value }))}>
                  <option value="">Alles</option>
                  {(field.select_options ?? []).map((option) => <option key={option}>{option}</option>)}
                </SelectInput>
              ) : field.data_type === "boolean" ? (
                <SelectInput value={customFilters[field.key] === undefined ? "" : String(customFilters[field.key])} onChange={(event) => setCustomFilters((current) => {
                  const next = { ...current };
                  if (event.target.value === "") delete next[field.key];
                  else next[field.key] = event.target.value === "true";
                  return next;
                })}>
                  <option value="">Alles</option><option value="true">Ja</option><option value="false">Nee</option>
                </SelectInput>
              ) : (
                <TextInput type={field.data_type === "number" ? "number" : field.data_type === "date" ? "date" : "text"} value={String(customFilters[field.key] ?? "")} onChange={(event) => setCustomFilters((current) => ({ ...current, [field.key]: event.target.value }))} />
              )}
            </FormField>
          ))}
        </div>
      )}

      {loading && <LoadingState label="Entiteiten laden…" />}
      {error && <ErrorState error={error} onRetry={() => void reload()} />}
      {data && (
        <div className="entity-management-layout">
          <section className="management-content">
            {editing && (
              <div className="panel editor-panel">
                <div className="section-heading"><div><p className="eyebrow">{editing === "new" ? "Nieuw" : "Bewerken"}</p><h2>{editing === "new" ? "Entiteit aanmaken" : editing.name}</h2></div></div>
                {data.entityTypes.length > 0 ? (
                  <EntityForm
                    key={editing === "new" ? "new" : editing.id + editing.updated_at}
                    entityTypes={data.entityTypes}
                    categories={data.categories}
                    initial={editing === "new" ? undefined : editing}
                    saving={mutation.saving}
                    onSubmit={saveEntity}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <EmptyState title="Eerst een entiteitType nodig">Maak een type aan op de configuratiepagina.</EmptyState>
                )}
              </div>
            )}

            <section className="panel entity-list-panel">
              <div className="section-heading">
                <div><p className="eyebrow">Resultaten</p><h2>{data.entities.length} entiteiten</h2></div>
              </div>
              <div className="entity-list" role="list">
                {data.entities.map((entity) => (
                  <article key={entity.id} className={`entity-row${entity.is_active ? "" : " entity-row--inactive"}`} role="listitem">
                    <span className="entity-color" style={{ backgroundColor: entity.resolved_color }} aria-label={`Kleur ${entity.resolved_color}`} />
                    <div className="entity-summary">
                      <strong>{entity.name}</strong>
                      <span>{entity.entity_type_name}{entity.category_path.length ? ` · ${entity.category_path.join(" › ")}` : ""}</span>
                    </div>
                    <div className="entity-values">
                      {Object.entries(entity.values).slice(0, 3).map(([key, value]) => <span key={key}><small>{key}</small>{String(value)}</span>)}
                    </div>
                    {!entity.is_active && <span className="chip">archief</span>}
                    <div className="row-actions">
                      {entity.is_active && <button className="icon-button" type="button" aria-label={`${entity.name} bewerken`} onClick={() => setEditing(entity)}>Bewerk</button>}
                      {entity.is_active && <button className="icon-button icon-button--danger" type="button" aria-label={`${entity.name} archiveren`} onClick={() => {
                        if (window.confirm(`Entiteit “${entity.name}” archiveren?`)) void mutate(() => deactivateEntity(entity.id), "Entiteit gearchiveerd.");
                      }}>Archiveer</button>}
                    </div>
                  </article>
                ))}
                {data.entities.length === 0 && (
                  <EmptyState title="Geen entiteiten gevonden">Maak een entiteit aan of pas de actieve filters aan.</EmptyState>
                )}
              </div>
            </section>
          </section>

          <CategoryManager categories={data.categories} saving={mutation.saving} mutate={mutate} />
        </div>
      )}
    </div>
  );
}
