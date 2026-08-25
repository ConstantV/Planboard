# Plan: Stap 10 — Resource occupancy, availability, shared filtering, colors, list view, openingstijden en popup-boekingsformulier

## Context

Planboard is compleet t/m stap 9. De gebruiker heeft aangegeven dat de volgende MVP-vereisten **binnen stap 10** moeten worden opgepakt:

1. **Openingstijden / werktijden configureren** — op welke dagen en tussen welke tijden de zaak open is of er gewerkt wordt.
2. **Boekingsformulier als popup** in plaats van een panel onder de kalender.
3. **Klik buiten de popup past datum/tijd aan** — terwijl de popup open is, kan de gebruiker in de kalender klikken om het tijdslot te wijzigen.
4. De bestaande stap‑10 scope: shared filters, list view, occupancy view, availability query, kleuren, export/logging en operationele kwaliteit.

## Status nu

Stap 10 is afgerond en alle kwaliteitsgates zijn groen:

- Backend: Ruff + 85 pytest-tests + Alembic drift-check groen.
- Frontend: ESLint + 70 Vitest-tests + build groen.
- E2E: 3 Playwright-tests groen.
- Openingstijden-model, API, UI en boekingsvalidatie werken.
- Modal boekingsformulier werkt; kalender blijft klikbaar terwijl de popup open is en het tijdslot wordt bijgewerkt.
- Kalenderrange volgt de geconfigureerde openingstijden.
- Gedeelde filterbalk met cumulatieve filters, actieve chips en wis-alles.
- Kalender- en lijstweergave delen dezelfde gefilterde dataset.
- Bezettingsweergave en availability-query tonen vrije entiteiten en vrije gaps.
- Kleurlegende en consistente kleurtoepassing in kalender, lijst en detail.
- CSV-export en gestructureerde backend-logging zijn ingebouwd.
- Toegankelijkheids- en responsive-review zijn doorlopen; tijdzonelogica is gecorrigeerd.

## Doelen voor het resterende werk

1. Voeg één gedeelde filterbalk toe bovenaan de Planning-pagina die werkt voor zowel kalender als lijst.
2. Bouw een lijstweergave die dezelfde gefilterde boekingen toont als de kalender.
3. Voeg een bezettingsweergave toe voor één exclusive entiteit met boekingen en vrije gaps.
4. Voeg een availability-query toe die vrije entiteiten voor een interval retourneert.
5. Toon een kleurlegende en zorg voor consistente kleurtoepassing in kalender, lijst, detail en legenda.
6. Voeg CSV-export toe voor de gefilterde boekingen.
7. Voeg gestructureerde logging toe in de backend.
8. Doorloop een toegankelijkheids- en responsive-check en los blockers op.
9. Houd alle kwaliteitsgates groen.

## Ontwerpbeslissingen

### Backend

- **Availability**: nieuwe service `availability_service.py` met `find_available_entities(session, start_at, end_at, role_definition_id=None, entity_type_id=None, category_id=None, filters=None, exclude_booking_id=None)`. Deze hergebruikt `find_booking_overlap` en half-open interval-semantiek, sluit geannuleerde en gearchiveerde entiteiten uit, en retourneert entiteiten die voor het hele interval vrij zijn.
- **Occupancy**: nieuwe service `occupancy_for_entity(session, entity_id, range_start, range_end)` retourneert boekingen en vrije gaps binnen de business hours van elke dag in het bereik. Deze functie wordt aangeroepen vanuit `GET /api/entities/{entity_id}/occupancy`.
- **Filters**: de bestaande `/bookings` filterset dekt al entity, rol, categorie, status, datum, tekst en veldfilters. De frontend gaat deze combineren via één gedeelde state.
- **Export**: nieuw endpoint `GET /api/bookings/export.csv` met dezelfde filters als `/bookings`; kolommen: id, start, eind, status, afspraaktype, deelnemers (als tekst), notities.
- **Logging**: standaard Python `logging` met een JSON-formatter voor productie en een leesbare formatter voor ontwikkeling; log boekingsmutaties en conflictsituaties op `INFO`/`WARNING`.

### Frontend

- **Filter state**: `PlanningPage` beheert één `BookingFilters`-object. Deze state blijft behouden bij wisselen tussen Kalender en Lijst. Datum-range wordt gesynchroniseerd met de kalender-range.
- **FilterBar component**: gegenereerd uit actieve entiteitstypen, rollen, categorieën, filterbare velden, status en datum. Toont actieve filters als chips met verwijderknop en een "Wis alles"-knop.
- **BookingList component**: tabel/lijst met boekingen, kleurindicator per deelnemer, sorteerbaar op starttijd.
- **OccupancyPanel**: selecteer een exclusive entiteit (dropdown met entiteiten waarvan de rol `is_exclusive` is), toon boekingen en vrije gaps in de geselecteerde periode.
- **AvailabilityPanel**: kies interval, rol, type, categorie; toon vrije entiteiten.
- **ColorLegend**: toon entiteitstypen/categorieën met kleur en tekstlabel.
- **CSV-export**: knop in PlanningPage die `/api/bookings/export.csv` aanroept met huidige filters.

## Implementatiestappen

### 1. Backend — availability & occupancy

- Maak `backend/app/services/availability_service.py`.
- Voeg routes toe in `backend/app/api/router.py`:
  - `GET /api/availability`
  - `GET /api/entities/{entity_id}/occupancy`
- Schrijf backend-tests in `backend/tests/test_availability.py` voor vrije, bezette, adjacent, geannuleerde, inactive en edit-exclusion scenario's.

### 2. Backend — CSV-export & logging

- Voeg `export_bookings_csv` service toe.
- Voeg `GET /api/bookings/export.csv` route toe.
- Test export in `backend/tests/test_booking_api.py`.
- Configureer logging in `backend/app/main.py` of `backend/app/core/logging.py`; log boekingscreatie/updates en conflicten.

### 3. Frontend — shared filters & list view

- Breid `BookingFilters` interface uit in `frontend/src/api/bookings.ts`.
- Bouw `frontend/src/components/booking/FilterBar.tsx`.
- Bouw `frontend/src/components/booking/BookingList.tsx`.
- Refactor `PlanningPage` om filter state centraal te beheren en door te geven aan kalender en lijst.
- Voeg Kalender/Lijst-toggle toe.
- Behoud filter state bij view-switch.
- Update `PlanningPage.test.tsx` met filter- en lijsttests.

### 4. Frontend — occupancy & availability panels

- Bouw `frontend/src/components/booking/OccupancyPanel.tsx`.
- Bouw `frontend/src/components/booking/AvailabilityPanel.tsx`.
- Voeg API-clients toe in `frontend/src/api/availability.ts`.
- Integreer panels in `PlanningPage` (bijv. als zijpanel of tabbladen).
- Schrijf component-tests.

### 5. Frontend — color legend & CSV export

- Bouw `frontend/src/components/booking/ColorLegend.tsx`.
- Voeg export-knop toe aan `PlanningPage`.
- Zorg dat kleurprecedentie (`resolve_entity_color`) overal wordt gebruikt.

### 6. Accessibility & responsiveness review

- Controleer focus-management in filterbalk, popup en lijst.
- Voeg `aria-labels` toe waar nodig.
- Test layout op tablet-breedte en smaller; pas CSS aan waar nodig.

### 7. Kwaliteitsgates en documentatie

- Backend: `uv run ruff check . && uv run pytest -q && uv run alembic check`.
- Frontend: `bun run check`.
- E2E: `bun run test:e2e` indien van toepassing.
- Update `docs/development-plan.md` (stap 10 Complete met testevidentie).
- Update `HANDOVER.md` indien van toepassing.
- Update `MyVault/01. Projects/Planboard/Planboard.md`.
- Commit stap 10 afzonderlijk voorafgaand aan stap 11.

## Acceptatiecriteria

- [x] Gedeelde filterbalk filtert cumulatief en toont actieve filters met wis-alles.
- [x] Kalender- en lijstweergave tonen dezelfde gefilterde boekingen.
- [x] Actieve filters blijven behouden bij wisselen tussen kalender en lijst.
- [x] Bezettingsweergave toont boekingen en vrije gaps voor een geselecteerde exclusive entiteit.
- [x] Availability-query retourneert vrije entiteiten voor een interval, inclusief role/type/category filters.
- [x] Kleuren zijn consistent in kalender, lijst, legenda en detailweergave.
- [x] CSV-export werkt met juiste kolommen en escaping.
- [x] Backend gates groen.
- [x] Frontend gates groen.
- [x] E2E-suite groen.
- [x] Documentatie en handover bijgewerkt.

## Open vragen / aannames

- We splitsen stap 10 niet verder uit in substappen; de resterende werkzaamheden vormen één geïntegreerde aflevering.
- De filterbalk wordt niet gepersisteerd in de URL in eerste instantie; we heroverwegen dat als het handmatig testen frictie geeft.
- Export beperkt zich tot CSV met UTF-8 en BOM voor Excel-compatibiliteit.
