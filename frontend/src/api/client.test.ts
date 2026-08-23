import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, queryString } from "./client";

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

  it("preserves structured validation and conflict details", async () => {
    const details = [{ entity_id: "entity-1" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "booking_conflict", message: "Tijdslot bezet", details },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await apiRequest("/bookings").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: "conflict",
      status: 409,
      code: "booking_conflict",
      message: "Tijdslot bezet",
      details,
    });
  });

  it("classifies unreachable API requests as offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiRequest("/health")).rejects.toMatchObject({ kind: "offline" });
  });

  it("supports empty 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiRequest<void>("/bookings/id", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("serializes combinable filters and nested custom fields", () => {
    expect(queryString({ status: "confirmed", filters: { brand: "Ford" }, empty: undefined })).toBe(
      "?status=confirmed&filters=%7B%22brand%22%3A%22Ford%22%7D",
    );
  });
});
