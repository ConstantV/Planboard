import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ConfigurationPage } from "./pages/ConfigurationPage";
import { EntitiesPage } from "./pages/EntitiesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlanningPage } from "./pages/PlanningPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/planning" replace />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="entities" element={<EntitiesPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
