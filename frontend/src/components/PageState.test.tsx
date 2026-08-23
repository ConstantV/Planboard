import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "./PageState";

describe("shared page states", () => {
  it("renders loading and empty states accessibly", () => {
    const { rerender } = render(<LoadingState label="Bookings laden…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Bookings laden…");

    rerender(<EmptyState title="Geen resultaat">Pas de filters aan.</EmptyState>);
    expect(screen.getByText("Geen resultaat")).toBeInTheDocument();
    expect(screen.getByText("Pas de filters aan.")).toBeInTheDocument();
  });

  it.each([
    ["offline", "Backend niet bereikbaar"],
    ["validation", "Controleer de invoer"],
    ["conflict", "Planningconflict"],
    ["server", "Gegevens konden niet worden geladen"],
  ] as const)("renders the %s error state and retries", async (kind, title) => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState error={new ApiError("Details", kind, 422, "error_code")} onRetry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(title);
    expect(screen.getByText("error_code")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Opnieuw proberen" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
