import { NavLink, Outlet } from "react-router-dom";

import { useApiHealth } from "../hooks/useApiHealth";
import { ConnectionStatus } from "./ConnectionStatus";

const navigation = [
  { to: "/planning", label: "Planning", mark: "P" },
  { to: "/entities", label: "Entiteiten", mark: "E" },
  { to: "/configuration", label: "Configuratie", mark: "C" },
];

export function AppShell() {
  const { status, check } = useApiHealth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/planning" aria-label="Planboard planning">
          <span className="brand-mark">PB</span>
          <span>
            <strong>Planboard</strong>
            <small>Planning workspace</small>
          </span>
        </NavLink>

        <nav className="main-nav" aria-label="Hoofdnavigatie">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
            >
              <span className="nav-mark" aria-hidden="true">
                {item.mark}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ConnectionStatus status={status} onRetry={() => void check()} />
          <small>Single-user MVP</small>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
