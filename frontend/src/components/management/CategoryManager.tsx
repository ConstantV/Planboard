import { useState, type FormEvent } from "react";

import { createCategory, deactivateCategory, updateCategory } from "../../api/entities";
import type { EntityCategory, EntityCategoryInput } from "../../types/api";
import { Checkbox, FormActions, FormField, SelectInput, TextInput } from "../FormControls";

function descendantsOf(categories: EntityCategory[], categoryId: string): Set<string> {
  const descendants = new Set<string>([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parent_id && descendants.has(category.parent_id) && !descendants.has(category.id)) {
        descendants.add(category.id);
        changed = true;
      }
    }
  }
  return descendants;
}

function CategoryForm({
  categories,
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  categories: EntityCategory[];
  initial?: EntityCategory;
  saving: boolean;
  onSubmit: (input: EntityCategoryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [parentId, setParentId] = useState(initial?.parent_id ?? "");
  const [useColor, setUseColor] = useState(Boolean(initial?.color));
  const [color, setColor] = useState(initial?.color ?? "#247483");
  const [error, setError] = useState("");
  const blocked = initial ? descendantsOf(categories, initial.id) : new Set<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Naam is verplicht.");
      return;
    }
    await onSubmit({ name: name.trim(), parent_id: parentId || null, color: useColor ? color : null });
  };

  return (
    <form className="management-form management-form--nested" onSubmit={(event) => void submit(event)} noValidate>
      <FormField label="Categorienaam" error={error}>
        <TextInput value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </FormField>
      <FormField label="Bovenliggende categorie">
        <SelectInput value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Geen — hoofdcategorie</option>
          {categories.filter((category) => !blocked.has(category.id)).map((category) => (
            <option key={category.id} value={category.id}>{category.path.join(" › ")}</option>
          ))}
        </SelectInput>
      </FormField>
      <div className="color-field">
        <Checkbox label="Categoriekleur gebruiken" checked={useColor} onChange={(event) => setUseColor(event.target.checked)} />
        <input aria-label="Categoriekleur" type="color" value={color} disabled={!useColor} onChange={(event) => setColor(event.target.value)} />
      </div>
      <FormActions>
        <button className="button button--ghost" type="button" onClick={onCancel}>Annuleren</button>
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? "Opslaan…" : initial ? "Categorie bijwerken" : "Categorie toevoegen"}</button>
      </FormActions>
    </form>
  );
}

export function CategoryManager({
  categories,
  saving,
  mutate,
}: {
  categories: EntityCategory[];
  saving: boolean;
  mutate: (operation: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<EntityCategory | "new" | null>(null);
  const ordered = [...categories].sort((left, right) =>
    left.path.join("/").localeCompare(right.path.join("/"), "nl"),
  );

  const save = async (input: EntityCategoryInput) => {
    const success = await mutate(
      () => editing && editing !== "new" ? updateCategory(editing.id, input) : createCategory(input),
      editing === "new" ? "Categorie toegevoegd." : "Categorie bijgewerkt.",
    );
    if (success) setEditing(null);
  };

  return (
    <section className="panel category-panel">
      <div className="section-heading">
        <div><p className="eyebrow">Indeling</p><h2>Categorieën</h2></div>
        <button className="button button--secondary" type="button" onClick={() => setEditing("new")}>Toevoegen</button>
      </div>
      {editing && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id + editing.updated_at}
          categories={categories}
          initial={editing === "new" ? undefined : editing}
          saving={saving}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="category-tree" role="tree" aria-label="Categorieboom">
        {ordered.map((category) => (
          <div
            key={category.id}
            className="category-row"
            role="treeitem"
            aria-level={category.path.length}
            style={{ paddingLeft: `${12 + (category.path.length - 1) * 18}px` }}
          >
            <span className="color-dot" style={{ backgroundColor: category.color ?? "#d9e1df" }} />
            <span className="category-name">{category.name}</span>
            <div className="row-actions">
              <button className="icon-button" type="button" aria-label={`${category.name} bewerken`} onClick={() => setEditing(category)}>Bewerk</button>
              <button className="icon-button icon-button--danger" type="button" aria-label={`${category.name} archiveren`} onClick={() => {
                if (window.confirm(`Categorie “${category.name}” archiveren?`)) {
                  void mutate(() => deactivateCategory(category.id), "Categorie gearchiveerd.");
                }
              }}>Archiveer</button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="muted-copy">Nog geen categorieën.</p>}
      </div>
    </section>
  );
}
