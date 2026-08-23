import { useCallback, useState } from "react";

import { ApiError } from "../api/client";

export function useMutationFeedback() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(async <T,>(operation: () => Promise<T>, success: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await operation();
      setNotice(success);
      return result;
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError("Er ging iets onverwachts mis.", "server"),
      );
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  return { saving, error, notice, run, clear };
}
