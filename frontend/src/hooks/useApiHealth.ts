import { useCallback, useEffect, useState } from "react";

import { getHealth } from "../api/health";

export type ApiStatus = "checking" | "online" | "offline";

export function useApiHealth(intervalMs = 10_000) {
  const [status, setStatus] = useState<ApiStatus>("checking");

  const check = useCallback(async () => {
    try {
      await getHealth();
      setStatus("online");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getHealth()
      .then(() => {
        if (active) setStatus("online");
      })
      .catch(() => {
        if (active) setStatus("offline");
      });
    const interval = window.setInterval(() => void check(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [check, intervalMs]);

  return { status, check };
}
