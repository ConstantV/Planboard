import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns decoded JSON for a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ status: string }>("/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/health",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("throws a useful error for a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(apiRequest("/health")).rejects.toThrow(
      "Planboard API request failed with status 503",
    );
  });
});
