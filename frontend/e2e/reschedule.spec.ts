import { expect, test, type Page } from "@playwright/test";

// Herplannen via de UI tegen een geïsoleerde wegwerp-database.
// De echte drag-and-drop interactie van FullCalendar wordt in de
// component-test suite gedekt; deze E2E-suite valideert het slot-update
// endpoint en de conflictmelding end-to-end via het bewerkformulier.
// Zie ook e2e/start-backend.sh.

function thisWeekSlot(offsetDays: number, hour: number, minute: number): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const target = new Date(monday);
  target.setDate(monday.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(hour)}:${pad(minute)}`;
}

async function installSalonPreset(page: Page) {
  await page.goto("/configuration");
  await page.getByRole("button", { name: /Kapperszaak/ }).click();
  await expect(page.getByText("Kapperszaak-preset geïnstalleerd.")).toBeVisible();
}

async function createEntity(page: Page, type: string, name: string) {
  await page.getByRole("link", { name: "Entiteiten", exact: true }).click();
  await page.getByRole("button", { name: "Nieuwe entiteit" }).click();
  const form = page.locator(".editor-panel");
  await form.getByLabel("EntiteitType").selectOption({ label: type });
  await form.getByLabel("Naam", { exact: true }).fill(name);
  await form.getByRole("button", { name: "Entiteit aanmaken" }).click();
  await expect(page.getByText("Entiteit aangemaakt.")).toBeVisible();
}

async function createBooking(
  page: Page,
  start: string,
  bookingType: string,
  customer: string,
  hairdresser: string,
  station: string,
) {
  await page.getByRole("link", { name: "Planning", exact: true }).click();
  await page.getByRole("button", { name: "Nieuwe booking" }).click();
  await page.getByLabel("Workflow").selectOption("hair_salon");
  await page.getByLabel("Start").fill(start);
  await page.getByLabel("Afspraaktype").selectOption({ label: bookingType });
  await page.getByLabel(/^Klant/).selectOption({ label: customer });
  await page.getByLabel(/^Kapster/).selectOption({ label: hairdresser });
  await page.getByLabel(/^Stoel/).selectOption({ label: station });
  await page.getByRole("button", { name: "Booking aanmaken" }).click();
  await expect(page.getByText("Booking aangemaakt.")).toBeVisible();
}

test("herplant een booking via het bewerkformulier en controleer persistentie", async ({ page }) => {
  const suffix = "herplan";
  const start = thisWeekSlot(2, 10, 0);
  const movedStart = thisWeekSlot(2, 11, 0);

  await installSalonPreset(page);
  await createEntity(page, "Klant", `Anna-${suffix}`);
  await createEntity(page, "Kapster", `Fatima-${suffix}`);
  await createEntity(page, "Stoel", `Stoel-${suffix}`);
  await createBooking(page, start, "Wassen", `Anna-${suffix}`, `Fatima-${suffix}`, `Stoel-${suffix}`);

  await page.locator(".fc-event", { hasText: `Anna-${suffix}` }).click();
  const details = page.getByRole("region", { name: "Bookingdetails" });
  await details.getByRole("button", { name: "Bewerken" }).click();

  await page.getByLabel("Start").fill(movedStart);
  await page.getByRole("button", { name: "Booking bijwerken" }).click();
  await expect(page.getByText("Booking bijgewerkt.")).toBeVisible();

  await page.reload();
  await page.locator(".fc-event", { hasText: `Anna-${suffix}` }).click();
  await expect(page.getByRole("region", { name: "Bookingdetails" }).getByText(new RegExp(movedStart.slice(11, 16)))).toBeVisible();
});

test("toont een conflict wanneer een booking naar een bezet exclusief tijdslot wordt verplaatst", async ({ page }) => {
  const suffix = "conflict";
  const firstStart = thisWeekSlot(3, 10, 0);
  const secondStart = thisWeekSlot(3, 11, 0);

  await installSalonPreset(page);
  await createEntity(page, "Klant", `Anna-${suffix}`);
  await createEntity(page, "Kapster", `Fatima-${suffix}`);
  await createEntity(page, "Stoel", `Stoel-${suffix}`);
  await createBooking(page, firstStart, "Wassen", `Anna-${suffix}`, `Fatima-${suffix}`, `Stoel-${suffix}`);
  await createBooking(page, secondStart, "Wassen", `Anna-${suffix}`, `Fatima-${suffix}`, `Stoel-${suffix}`);

  await page.locator(".fc-event", { hasText: `Anna-${suffix}` }).nth(1).click();
  const details = page.getByRole("region", { name: "Bookingdetails" });
  await details.getByRole("button", { name: "Bewerken" }).click();

  await page.getByLabel("Start").fill(firstStart);
  await page.getByRole("button", { name: "Booking bijwerken" }).click();

  await expect(page.getByText("Actie niet mogelijk")).toBeVisible();
  await expect(page.getByText(/Fatima-.*is bezet/)).toBeVisible();
});
