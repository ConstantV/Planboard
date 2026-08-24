import type { ApiError } from "../api/client";
import type { BookingConflict } from "../types/api";

function formatInterval(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.formatRange(new Date(start), new Date(end))}`;
}

export function MutationFeedback({
  error,
  notice,
}: {
  error: ApiError | null;
  notice: string | null;
}) {
  const conflicts =
    error?.kind === "conflict" && Array.isArray(error.details)
      ? (error.details as BookingConflict[])
      : [];

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
          {conflicts.length > 0 && (
            <ul className="conflict-list">
              {conflicts.map((conflict) => (
                <li key={`${conflict.booking_id}-${conflict.entity_id}`}>
                  {conflict.entity_name} ({conflict.conflicting_role_key}) is bezet van{" "}
                  {formatInterval(conflict.start_at, conflict.end_at)}
                </li>
              ))}
            </ul>
          )}
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
