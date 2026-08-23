import type { ApiStatus } from "../hooks/useApiHealth";

const labels: Record<ApiStatus, string> = {
  checking: "API controleren",
  online: "API online",
  offline: "API offline",
};

interface ConnectionStatusProps {
  status: ApiStatus;
  onRetry: () => void;
}

export function ConnectionStatus({ status, onRetry }: ConnectionStatusProps) {
  if (status === "offline") {
    return (
      <button className="status status--offline" type="button" onClick={onRetry}>
        {labels[status]} · opnieuw
      </button>
    );
  }

  return (
    <span className={`status status--${status}`} role="status" aria-live="polite">
      {labels[status]}
    </span>
  );
}
