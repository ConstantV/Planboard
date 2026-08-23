import type { ReactNode } from "react";

import type { ApiError } from "../api/client";

export function LoadingState({ label = "Gegevens laden…" }: { label?: string }) {
  return (
    <div className="page-state page-state--loading" role="status" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page-state page-state--empty">
      <span className="state-icon" aria-hidden="true">
        ○
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const title =
    error.kind === "offline"
      ? "Backend niet bereikbaar"
      : error.kind === "conflict"
        ? "Planningconflict"
        : error.kind === "validation"
          ? "Controleer de invoer"
          : "Gegevens konden niet worden geladen";

  return (
    <div className={`page-state page-state--error page-state--${error.kind}`} role="alert">
      <span className="state-icon" aria-hidden="true">
        !
      </span>
      <h2>{title}</h2>
      <p>{error.message}</p>
      {error.code && <code>{error.code}</code>}
      <button className="button button--primary" type="button" onClick={onRetry}>
        Opnieuw proberen
      </button>
    </div>
  );
}
