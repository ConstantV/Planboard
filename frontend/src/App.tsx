import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/PageState";

const PlanningPage = lazy(() =>
  import("./pages/PlanningPage").then((module) => ({ default: module.PlanningPage })),
);
const EntitiesPage = lazy(() =>
  import("./pages/EntitiesPage").then((module) => ({ default: module.EntitiesPage })),
);
const ConfigurationPage = lazy(() =>
  import("./pages/ConfigurationPage").then((module) => ({ default: module.ConfigurationPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/planning" replace />} />
        <Route path="planning" element={<Suspense fallback={<LoadingState />}><PlanningPage /></Suspense>} />
        <Route path="entities" element={<Suspense fallback={<LoadingState />}><EntitiesPage /></Suspense>} />
        <Route path="configuration" element={<Suspense fallback={<LoadingState />}><ConfigurationPage /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<LoadingState />}><NotFoundPage /></Suspense>} />
      </Route>
    </Routes>
  );
}
