import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { listBookings } from "./api/bookings";
import { listEntityTypes, listRoleDefinitions } from "./api/configuration";
import { listCategories, listEntities } from "./api/entities";
import { getHealth } from "./api/health";

vi.mock("./api/health", () => ({
  getHealth: vi.fn(),
}));

vi.mock("./api/bookings", () => ({
  listBookings: vi.fn(),
}));

vi.mock("./api/configuration", () => ({
  listEntityTypes: vi.fn(),
  listRoleDefinitions: vi.fn(),
}));

vi.mock("./api/entities", () => ({
  listCategories: vi.fn(),
  listEntities: vi.fn(),
}));

vi.mock("./components/ScheduleCalendar", () => ({
  ScheduleCalendar: ({ events }: { events: unknown[] }) => (
    <div data-testid="calendar">{events.length} events</div>
  ),
}));

const mockedGetHealth = vi.mocked(getHealth);
const mockedListBookings = vi.mocked(listBookings);
const mockedListEntityTypes = vi.mocked(listEntityTypes);
const mockedListRoleDefinitions = vi.mocked(listRoleDefinitions);
const mockedListEntities = vi.mocked(listEntities);
const mockedListCategories = vi.mocked(listCategories);

function renderRoute(path = "/planning") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  beforeEach(() => {
    mockedGetHealth.mockReset().mockResolvedValue({ status: "ok", service: "planboard-api" });
    mockedListBookings.mockReset().mockResolvedValue([]);
    mockedListEntityTypes.mockReset().mockResolvedValue([]);
    mockedListRoleDefinitions.mockReset().mockResolvedValue([]);
    mockedListEntities.mockReset().mockResolvedValue([]);
    mockedListCategories.mockReset().mockResolvedValue([]);
  });

  it("loads the server-backed planning route without demo events", async () => {
    renderRoute();

    expect(screen.getByText("API controleren")).toBeInTheDocument();
    expect(await screen.findByText("API online")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Planning calendar" })).toBeInTheDocument();
    expect(screen.getByTestId("calendar")).toHaveTextContent("0 events");
    expect(screen.getByText("Nog geen bookings")).toBeInTheDocument();
  });

  it("navigates between all page-level routes", async () => {
    const user = userEvent.setup();
    renderRoute();

    await screen.findByRole("heading", { name: "Planning" });
    await user.click(screen.getByRole("link", { name: "Entiteiten" }));
    expect(await screen.findByRole("heading", { name: "Entiteiten" })).toBeInTheDocument();
    expect(screen.getByText("Nog geen entiteiten")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Configuratie" }));
    expect(await screen.findByRole("heading", { name: "Configuratie" })).toBeInTheDocument();
    expect(screen.getByText("Nog geen configuratie")).toBeInTheDocument();
  });

  it("recovers the connection indicator without reloading the page", async () => {
    const user = userEvent.setup();
    mockedGetHealth.mockRejectedValue(new Error("Network unavailable"));
    renderRoute();

    const retry = await screen.findByRole("button", { name: /API offline/ });
    mockedGetHealth.mockResolvedValue({ status: "ok", service: "planboard-api" });
    await user.click(retry);

    expect(await screen.findByText("API online")).toBeInTheDocument();
  });

  it("shows a useful not-found route", async () => {
    renderRoute("/bestaat-niet");

    expect(await screen.findByText("Pagina niet gevonden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terug naar de planning" })).toBeInTheDocument();
  });
});
