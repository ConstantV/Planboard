import { useCallback } from "react";

import { listEntityTypes, listRoleDefinitions } from "../api/configuration";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PageHeader } from "../components/PageHeader";
import { useApiResource } from "../hooks/useApiResource";

export function ConfigurationPage() {
  const loader = useCallback(async () => {
    const [entityTypes, roles] = await Promise.all([listEntityTypes(), listRoleDefinitions()]);
    return { entityTypes, roles };
  }, []);
  const { data, error, loading, reload } = useApiResource(loader);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Beheer"
        title="Configuratie"
        description="Entiteittypen, configureerbare velden en planningrollen bepalen hoe deze workspace werkt."
      />
      {loading && <LoadingState label="Configuratie laden…" />}
      {error && <ErrorState error={error} onRetry={() => void reload()} />}
      {data && (
        <section className="panel">
          <div className="metric-grid" aria-label="Configuratieoverzicht">
            <article><strong>{data.entityTypes.length}</strong><span>Entiteittypen</span></article>
            <article><strong>{data.roles.length}</strong><span>Planningrollen</span></article>
            <article>
              <strong>{data.entityTypes.reduce((count, type) => count + type.fields.length, 0)}</strong>
              <span>Configureerbare velden</span>
            </article>
          </div>
          {data.entityTypes.length === 0 && (
            <EmptyState title="Nog geen configuratie">
              In stap 7 kun je hier een preset installeren of zelf typen en velden definiëren.
            </EmptyState>
          )}
        </section>
      )}
    </div>
  );
}
