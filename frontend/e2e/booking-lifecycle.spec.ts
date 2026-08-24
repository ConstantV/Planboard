import { expect, test } from "@playwright/test";

// Volledige booking-levenscyclus door de echte stack heen: preset installeren,
// entiteiten aanmaken, boeken met vaste duur, bewerken en annuleren.
// Draait tegen een wegwerp-database (zie e2e/start-backend.sh).

function thisWeekSlot(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const wednesday = new Date(monday);
  wednesday.setDate(monday.getDate() + 2);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wednesday.getFullYear()}-${pad(wednesday.getMonth() + 1)}-${pad(wednesday.getDate())}T10:00`;
}

test("booking-levenscyclus: aanmaken, bekijken, bewerken, annuleren", async ({ page }) => {
  const start = thisWeekSlot();
  const expectedEnd = `${start.slice(0, 10)}T10:45`;

  // 1. Installeer de kapperszaak-preset (typen, rollen, afspraaktypen).
  await page.goto("/configuration");
  await page.getByRole("button", { name: /Kapperszaak/ }).click();
  await expect(page.getByText("Kapperszaak-preset geïnstalleerd.")).toBeVisible();

  // 2. Maak de deelnemende entiteiten aan.
  await page.getByRole("link", { name: "Entiteiten", exact: true }).click();
  for (const [type, name] of [
    ["Klant", "Anna"],
    ["Kapster", "Fatima"],
  ] as const) {
    await page.getByRole("button", { name: "Nieuwe entiteit" }).click();
    const form = page.locator(".editor-panel");
    await form.getByLabel("EntiteitType").selectOption({ label: type });
    await form.getByLabel("Naam", { exact: true }).fill(name);
    await form.getByRole("button", { name: "Entiteit aanmaken" }).click();
    await expect(page.getByText("Entiteit aangemaakt.")).toBeVisible();
  }

  // 3. Boek "Knippen" (vaste duur van 45 minuten): de eindtijd wordt afgedwongen.
  await page.getByRole("link", { name: "Planning", exact: true }).click();
  await page.getByRole("button", { name: "Nieuwe booking" }).click();
  await page.getByLabel("Workflow").selectOption("hair_salon");
  await page.getByLabel("Start").fill(start);
  await page.getByLabel("Afspraaktype").selectOption({ label: "Knippen" });

  const einde = page.getByLabel("Einde");
  await expect(einde).toHaveValue(expectedEnd);
  await expect(einde).toBeDisabled();

  await page.getByLabel(/^Klant/).selectOption({ label: "Anna" });
  await page.getByLabel(/^Kapster/).selectOption({ label: "Fatima" });
  await page.getByLabel("Notities").fill("Eerste bezoek");
  await page.getByRole("button", { name: "Booking aanmaken" }).click();
  await expect(page.getByText("Booking aangemaakt.")).toBeVisible();

  // 4. Bekijk de bookingdetails via het kalenderevent.
  const event = page.locator(".fc-event", { hasText: "Anna" });
  await expect(event).toBeVisible();
  await event.click();
  const details = page.getByRole("region", { name: "Bookingdetails" });
  await expect(details.getByRole("heading", { name: "Knippen" })).toBeVisible();
  await expect(details.getByText("45 minuten (vast)")).toBeVisible();
  await expect(details.getByText("Eerste bezoek")).toBeVisible();

  // 5. Bewerk de notities; de vaste duur blijft afgedwongen.
  await details.getByRole("button", { name: "Bewerken" }).click();
  await expect(page.getByLabel("Einde")).toBeDisabled();
  await page.getByLabel("Notities").fill("Bijgewerkte notitie");
  await page.getByRole("button", { name: "Booking bijwerken" }).click();
  await expect(page.getByText("Booking bijgewerkt.")).toBeVisible();

  await page.locator(".fc-event", { hasText: "Anna" }).click();
  await expect(
    page.getByRole("region", { name: "Bookingdetails" }).getByText("Bijgewerkte notitie"),
  ).toBeVisible();

  // 6. Annuleer de booking; het event blijft uitgegrijsd zichtbaar.
  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .getByRole("region", { name: "Bookingdetails" })
    .getByRole("button", { name: "Annuleer booking" })
    .click();
  await expect(page.getByText("Booking geannuleerd.")).toBeVisible();
  await expect(page.locator(".fc-event.booking--cancelled")).toHaveCount(1);
});
