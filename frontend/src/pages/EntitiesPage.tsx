import { useCallback } from "react";

import { listEntityTypes } from "../api/configuration";
import { listCategories, listEntities } from "../api/entities";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { useApiResource } from "../hooks/useApiResource";

export function EntitiesPage() {
  const loader = useCallback(async () => {
    const [entities, entityTypes, categories] = await Promise.all([
      listEntities(),
      listEntityTypes(),
      listCategories(),
    ]);
    return { entities, entityTypes, categories };
  }, []);
  const { data, error, loading, reload } = useApiResource(loader);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Stamgegevens"
        title="Entiteiten"
        description="Klanten, medewerkers, objecten en resources gebruiken dezelfde configureerbare kern."
      />
      {loading && <LoadingState label="Entiteiten laden…" />}
      {error && <ErrorState error={error} onRetry={() => void reload()} />}
      {data && (
        <section className="panel">
          <div className="metric-grid" aria-label="Entiteitoverzicht">
            <article><strong>{data.entities.length}</strong><span>Actieve entiteiten</span></article>
            <article><strong>{data.entityTypes.length}</strong><span>Entiteittypen</span></article>
            <article><strong>{data.categories.length}</strong><span>Categorieën</span></article>
          </div>
          {data.entities.length === 0 && (
            <EmptyState title="Nog geen entiteiten">
              In stap 7 komt hier het volledige beheer voor typen, categorieën en entiteiten.
            </EmptyState>
          )}
        </section>
      )}
    </div>
  );
}
