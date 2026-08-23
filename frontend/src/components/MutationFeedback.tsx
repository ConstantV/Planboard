import type { ApiError } from "../api/client";

export function MutationFeedback({
  error,
  notice,
}: {
  error: ApiError | null;
  notice: string | null;
}) {
  return (
    <div className="feedback-stack" aria-live="polite">
      {error && (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <strong>
            {error.kind === "validation"
              ? "Controleer de gegevens"
              : error.kind === "conflict"
                ? "Actie niet mogelijk"
                : "Opslaan mislukt"}
          </strong>
          <span>{error.message}</span>
          {error.code && <code>{error.code}</code>}
        </div>
      )}
      {notice && (
        <div className="inline-feedback inline-feedback--success" role="status">
          <strong>Gelukt</strong>
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
