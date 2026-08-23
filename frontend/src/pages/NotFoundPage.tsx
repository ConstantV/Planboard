import { Link } from "react-router-dom";

import { EmptyState } from "../components/PageState";

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState title="Pagina niet gevonden">
        Deze route bestaat niet. <Link to="/planning">Terug naar de planning</Link>.
      </EmptyState>
    </div>
  );
}
