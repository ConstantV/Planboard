import { useEffect, useState } from "react";

import { getHealth } from "./api/health";
import { ScheduleCalendar } from "./components/ScheduleCalendar";

type ApiStatus = "checking" | "online" | "offline";

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Scheduling workspace</p>
          <h1>Planboard</h1>
        </div>
        <span
          className={`status status--${apiStatus}`}
          role="status"
          aria-live="polite"
        >
          API: {apiStatus}
        </span>
      </header>

      <section className="calendar-panel" aria-label="Planning calendar">
        <ScheduleCalendar />
      </section>
    </main>
  );
}
