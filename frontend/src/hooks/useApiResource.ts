import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../api/client";

interface ResourceState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

function normalizedError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError("Er ging iets onverwachts mis.", "server");
}

export function useApiResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await loader();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error: normalizedError(error), loading: false });
    }
  }, [loader]);

  useEffect(() => {
    let active = true;
    void loader()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ data: null, error: normalizedError(error), loading: false });
        }
      });
    return () => {
      active = false;
    };
  }, [loader]);

  return { ...state, reload };
}
