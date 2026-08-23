import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getHealth } from "./api/health";

vi.mock("./api/health", () => ({
  getHealth: vi.fn(),
}));

vi.mock("./components/ScheduleCalendar", () => ({
  ScheduleCalendar: () => <div>Calendar</div>,
}));

const mockedGetHealth = vi.mocked(getHealth);

describe("App", () => {
  beforeEach(() => {
    mockedGetHealth.mockReset();
  });

  it("shows the online state after a successful API check", async () => {
    mockedGetHealth.mockResolvedValue({ status: "ok", service: "planboard-api" });

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("API: checking");
    expect(await screen.findByText("API: online")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Planning calendar" })).toBeInTheDocument();
  });

  it("shows the offline state when the API check fails", async () => {
    mockedGetHealth.mockRejectedValue(new Error("Network unavailable"));

    render(<App />);

    expect(await screen.findByText("API: offline")).toBeInTheDocument();
  });
});
