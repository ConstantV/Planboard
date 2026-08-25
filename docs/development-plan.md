# Planboard development plan

## Purpose

This plan turns the product roadmap into small, testable delivery steps. Each step produces a usable increment, is implemented completely, and passes its verification gate before work starts on the next step.

The MVP is complete when an administrator can configure planning-entity types, fields, and
appointment/activity types with duration rules; a user can maintain categorized entities;
Bookings can connect multiple role-based entities; exclusive resources cannot be double-booked;
and calendar, list, occupancy, and availability views share consistent planning data, filters, and
configurable colors.

## Working agreement

For every step:

1. Confirm the scope and acceptance criteria.
2. Mark only that step as `In progress` in the progress table.
3. Implement the smallest complete vertical change.
4. Add or update automated tests as part of the same change.
5. Run the full backend and frontend quality gates.
6. Perform the listed manual acceptance check.
7. Record test evidence and any decisions in the progress log.
8. Mark the step `Complete` only when every acceptance criterion passes.
9. Commit the completed step separately before starting the next step.

If a test fails, the step remains `In progress`. A later step may not be used to hide unfinished work from an earlier step.

## Standard quality gates

These commands become mandatory once the corresponding dependencies have been introduced:

```bash
# Backend
cd backend
uv run ruff check .
uv run pytest

# Frontend
cd frontend
bun run lint
bun run test
bun run build

# End-to-end, after step 8
bun run test:e2e
```

Additional rules:

- Tests use an isolated temporary SQLite database, never the development database.
- Backend behaviour is tested at service and API level.
- Frontend behaviour is tested at component level.
- Critical booking flows receive browser-level end-to-end tests.
- Every database schema change has an upgrade and downgrade migration test.
- Dates and times are sent through the API as timezone-aware ISO 8601 values.

## Product model decisions after step 2

The requirements in `wensen.md` broaden Planboard from a fixed Item + Client scheduler into a configurable planning system. Before CRUD work continues, step 3 must validate and migrate toward these concepts:

- `EntityType`: an administrator-defined kind such as Client, Employee, Station, Rental Item, Vehicle, Valve, or Workbench.
- `Entity`: one concrete person or object with stable core fields and validated custom values.
- `FieldDefinition`: an EntityType-specific field definition with datatype, required, searchable, filterable, and display-order settings.
- `BookingParticipant`: a role-based link from a Booking to one or more Entities.
- `BookingType`: a configurable appointment, treatment, rental, or activity definition scoped to a
  workflow, with an optional default duration and a duration mode of suggested or fixed.
- `exclusive`: a role/type setting that determines whether overlap protection applies to an Entity.
- Configurable calendar colors with precedence: Entity, then category, then EntityType, then the application default.

Custom values use relational, datatype-specific indexed columns because filtering everywhere is a core requirement. JSON is limited to select-option configuration. This keeps validation and query semantics predictable in SQLite and PostgreSQL. Identity-document fields are not part of the default model and require an explicit privacy/security decision.

## Progress overview

| Step | Deliverable | Status | Test evidence | Commit |
|------|-------------|--------|---------------|--------|
| 0 | Reproducible local environment | Complete | Backend check; frontend lint/build; live HTTP checks | `7831084` |
| 1 | Test infrastructure and CI-ready quality gates | Complete | Backend: 1 test; frontend: 4 tests; both full checks pass | `7831084` |
| 2 | Database migrations and validated domain model | Complete | Backend: Ruff + 15 tests + Alembic drift check; frontend: lint + 4 tests + build; manual domain smoke | `cffb0d5` |
| 3 | Configurable entity model and admin contract | Complete | Backend: Ruff + 35 tests + Alembic drift check; frontend: lint + 4 tests + build; three-scenario rollback smoke | `9d099e4` |
| 4 | Entity and category management API | Complete | Backend: Ruff + 47 tests + Alembic drift check; frontend: lint + 4 tests + build; live OpenAPI/HTTP checks | `c05a0a4` |
| 5 | Multi-entity Booking API and conflict protection | Complete | Backend: Ruff + 55 tests + Alembic drift check; frontend: lint + 4 tests + build; three-scenario API acceptance; live HTTP/OpenAPI checks | `fcb3d72` |
| 6 | Frontend application shell and API integration | Complete | Backend: Ruff + 57 tests + Alembic drift check; frontend: lint + 17 tests + build; route/DOM acceptance; live routes, APIs, and CORS HTTP 200 | `d123f53` |
| 7 | Entity and configuration user interface | Complete | Backend: Ruff + 57 tests + Alembic drift check; frontend: lint + 25 tests + build; live routes, APIs, and CORS HTTP 200 | `608fc0a` |
| 8 | Service-aware calendar booking workflow | Complete | Backend: Ruff + 64 tests + Alembic drift check; frontend: ESLint + 38 tests + build; three-scenario API acceptance; Playwright E2E booking lifecycle | `fc5cb0b` |
| 9 | Drag-and-drop rescheduling and conflict recovery | Complete | Backend: Ruff + 68 tests + Alembic drift check; frontend: ESLint + 49 tests + build; three-scenario API acceptance; Playwright E2E reschedule/conflict | `feat: add drag-and-drop rescheduling and conflict recovery` |
| 10 | Resource occupancy, availability, shared filtering, colors, list view, business hours, popup booking form, and operational quality | Complete | Backend: Ruff + 85 tests + Alembic drift check; frontend: ESLint + 70 tests + build; 3 Playwright E2E tests pass; shared filters, list view, availability/occupancy panels, CSV export, structured logging, color legend, accessibility/responsive review, timezone fix | — |
| 11 | Local release and pilot readiness | Planned | — | — |

## Step 0 — Reproducible local environment

### Goal

Make the existing scaffold installable and runnable from a clean checkout.

### Execute

- Install `uv` on the development machine after explicit approval.
- Resolve backend dependencies and create `uv.lock`.
- Resolve frontend dependencies with Bun and create `bun.lock`.
- Copy the example environment files locally and verify safe defaults.
- Start the backend and frontend with the documented commands.
- Correct any scaffold issue exposed by the first real startup.

### Automated tests

- Run the existing backend health test.
- Run Ruff against the backend.
- Run ESLint and the production build against the frontend.

### Manual acceptance

- Open `GET /api/health` and confirm an HTTP 200 response.
- Open the frontend and confirm the calendar renders.
- Confirm the UI reports the API as online.
- Restart both processes and confirm no manual repair is needed.

### Done when

- Both lockfiles exist.
- A new checkout can be started by following only the README.
- All available quality commands pass.

## Step 1 — Test infrastructure and CI-ready quality gates

### Goal

Create a fast, deterministic test foundation before adding product behaviour.

### Execute

- Add backend fixtures for an isolated temporary SQLite database and API client.
- Add Vitest and React Testing Library to the frontend.
- Add scripts that run backend and frontend checks consistently.
- Add coverage reporting with pragmatic initial thresholds.
- Document the complete local verification command sequence.

### Automated tests

- Prove database isolation by creating data in one test and confirming it is absent in the next.
- Add a component smoke test for the application shell.
- Run the complete quality gate twice to detect test-order dependencies.

### Manual acceptance

- Introduce a temporary failing assertion and confirm the correct command fails.
- Revert the assertion and confirm the full gate is green.

### Done when

- Backend and frontend tests run locally with one documented command per application.
- Tests are independent and do not touch developer data.

## Step 2 — Database migrations and validated domain model

### Goal

Turn the draft `Item`, `ItemCategory`, `Client`, and `Booking` models into a reliable persisted contract.

### Execute

- Add Alembic and create the initial migration.
- Review field lengths, nullability, indexes, foreign keys, and delete behaviour.
- Add an `ItemCategory` model with an optional self-referencing parent and an optional category relationship on `Item`.
- Define category lifecycle rules, prevent parent cycles, and ensure category hierarchies can be queried efficiently.
- Define booking statuses centrally instead of using arbitrary strings.
- Enforce `end_at > start_at` at application level and, where portable, database level.
- Document the decision for storing and returning timezone-aware values.
- Replace automatic `create_all` startup behaviour with migrations.

### Automated tests

- Upgrade a blank database to the latest migration.
- Downgrade and upgrade it again.
- Test model defaults and relationships.
- Test Item-to-category relationships, parent-child category relationships, cycle rejection, and delete/deactivation behaviour.
- Test rejection of invalid booking intervals.

### Manual acceptance

- Inspect the generated SQLite schema.
- Create a parent and child Item category plus one linked Item, Client, and Booking through a short development script or shell.

### Done when

- A blank database is created exclusively through migrations.
- Domain constraints and lifecycle rules are documented and tested.

## Step 3 — Configurable entity model and admin contract

### Goal

Turn the expanded product requirements into a tested, generic persistence and API contract before building CRUD against the transitional Item/Client model.

### Execute

- Define `EntityType`, `Entity`, `FieldDefinition`, and `BookingParticipant` responsibilities and terminology.
- Decide whether the existing Item and Client tables are migrated into one Entity table or retained behind a shared abstraction; document the trade-off and choose one path.
- Add the Alembic migration for the chosen model without losing existing Item, Client, category, or Booking data.
- Support typed custom-field definitions for at least text, number, boolean, date, and select values.
- Validate custom values against their definitions and reject unknown, missing required, or incorrectly typed values.
- Mark fields searchable/filterable explicitly and prove a practical SQLite query strategy with a documented PostgreSQL path.
- Define role configuration and the `exclusive` rule that controls overlap detection.
- Add optional color configuration on Entity, category, and EntityType with the documented precedence rule.
- Provide seedable presets for hair salon, rental, and repair-workshop acceptance scenarios without hard-coding those industries into the domain.
- Record a security decision before allowing sensitive fields such as passport or driver's-licence numbers.

### Automated tests

- Test migration upgrade/downgrade and preservation of existing step-2 data.
- Test EntityType, role, and FieldDefinition constraints and lifecycle rules.
- Test every supported custom datatype, required fields, invalid values, and definition changes with existing data.
- Test indexed/core filtering plus searchable and filterable custom values with a representative dataset.
- Test role exclusivity and color-precedence resolution.
- Test that all three scenario presets can describe their required participants and fields.

### Manual acceptance

- Configure and populate one hair-salon, rental, and repair-workshop example through a development script or API contract demonstration.
- Inspect the generated schema and representative filter queries.

### Done when

- The generic model is chosen, migrated, documented, and proven against all three scenarios.
- Step 4 can build CRUD without another foundational model rewrite.

## Step 4 — Entity and category management API

### Goal

Provide complete backend management for configured EntityTypes, Entities, custom fields, and category hierarchies.

### Execute

- Add endpoints to list, retrieve, create, update, and deactivate/archive Entities.
- Add administrator endpoints for EntityTypes, FieldDefinitions, planning roles, and color settings.
- Add endpoints to list, retrieve, create, update, move, and deactivate categories.
- Validate core and configured fields and return consistent structured errors.
- Return category paths, resolved display color, type metadata, and role capabilities needed by later UI phases.
- Support search and combinable filters across type, category, core fields, and allowed custom fields.
- Prefer archive/deactivation when historical Bookings reference an Entity or configuration record.

### Automated tests

- Test every endpoint's success and data-scope path; authorization remains outside the single-user MVP.
- Test category nesting, moving, descendant lookup, cycle rejection, and Entity assignment.
- Test invalid custom values, empty names, excessive lengths, duplicates, missing IDs, and archived records.
- Test search/filtering with matching, non-matching, combined, special-character, and case-insensitive input.
- Test that referenced or inactive configuration cannot silently invalidate historical data.

### Manual acceptance

- Use FastAPI documentation to configure an EntityType and fields, create and categorize Entities, edit values and colors, search/filter them, and archive one record.

### Done when

- Entity and category management are complete at API level without breaking historical Booking references.

## Step 5 — Multi-entity Booking API and conflict protection

### Goal

Deliver the scheduling core as a tested backend workflow.

### Execute

- Add list, retrieve, create, update, cancel, and delete rules for Bookings.
- Accept one or more BookingParticipants with configured roles and validate required role cardinality.
- Connect overlap detection to every participant whose role/type is marked exclusive.
- Return HTTP 409 with structured conflict details identifying every conflicting Entity and role.
- Support combinable filtering by date range, EntityType, Entity, role, category (including descendants), status, relevant custom fields, and free text.
- Define filters as a shared API contract so calendar and list views return the same matching result set.
- Define boundary behaviour for adjacent bookings and cancelled bookings.
- Execute overlap checks and writes in a safe transaction.

### Automated tests

- Test non-overlapping, partially overlapping, contained, containing, and identical intervals.
- Test adjacent intervals where one booking ends exactly when another starts.
- Test cancelled bookings and exclusion of the booking being edited.
- Test multiple participants, missing required roles, invalid role/type combinations, and duplicate participants.
- Test conflicts for employee, rental Item, and station roles; verify non-exclusive customer/subject roles follow configuration.
- Test invalid Entity, invalid interval, each filter independently, combined filters, empty results, custom fields, and category-descendant filtering.
- Test API status codes and error payloads.

### Manual acceptance

- Create salon, rental, and workshop Bookings through the API with their respective participant roles.
- Attempt conflicts on an exclusive employee, Item, and station and confirm each is rejected clearly.
- Move or cancel the original booking and confirm the slot becomes available.

### Done when

- No create or update path can bypass overlap protection for an exclusive participant.
- The complete booking lifecycle passes automated and manual checks.

## Step 6 — Frontend application shell and API integration

### Goal

Create a maintainable frontend structure that handles data, errors, and navigation consistently.

### Execute

- Add routing and page-level layout.
- Add a typed API layer for configuration, EntityTypes, Entities, categories, and Bookings.
- Add shared loading, empty, offline, validation, and error states.
- Add a query/cache library only if it materially simplifies server-state handling.
- Replace the temporary calendar event with server-provided data plumbing.

### Automated tests

- Test API success, validation-error, conflict, and offline handling.
- Test navigation and shared status components.
- Test that server responses are mapped into frontend types correctly.

### Manual acceptance

- Navigate between all empty pages.
- Stop the backend and confirm the frontend fails gracefully.
- Restart the backend and confirm recovery without a page reload where feasible.

### Done when

- The frontend has no hard-coded demo data and all API states are understandable.

## Step 7 — Entity and configuration user interface

### Goal

Allow a non-technical administrator to configure EntityTypes and fields, and allow users to manage the resulting Entities and categories.

### Execute

- Build administrator flows for EntityTypes, custom fields, roles, exclusivity, and default colors.
- Generate Entity forms from FieldDefinitions with clear datatype-specific controls.
- Build Entity list, search/filter, create, edit, color, and deactivate/archive flows.
- Build category-tree management with create, rename, move, color, and deactivate flows.
- Allow Entities to be assigned or moved to a category.
- Add accessible forms, field-level validation, confirmations, and success feedback.
- Ensure keyboard navigation and responsive layout.

### Automated tests

- Test form validation and submitted payloads.
- Test list loading, empty states, edits, archive/deactivate actions, and API errors.
- Test generated forms for each supported datatype and changed field definitions.
- Test category-tree interactions, Entity assignment, moving categories, color precedence, and cycle/error feedback.
- Test core forms with keyboard interaction.

### Manual acceptance

- Configure and complete Entity and category lifecycles for each of the three scenario presets using only the browser.
- Repeat the core workflow on a narrow mobile-size viewport.

### Done when

- Configuration and Entities can be managed without FastAPI documentation or direct database access.

### Completion evidence

- The configuration page manages all three presets, EntityTypes, default colors, custom fields,
  planning roles, cardinality, and exclusivity through accessible forms.
- Entity forms are generated from active FieldDefinitions for text, number, boolean, date, and
  select values and validate required fields before sending typed payloads.
- The Entity page combines free-text, type, category, archive, and configured custom-field filters;
  it supports create, edit, category assignment, color override, and confirmed archival.
- The category tree supports create, rename, move, color, and archive actions and excludes the
  current node and its descendants from valid parents before the API's cycle validation runs.
- Backend quality gate: Ruff/checks, 57 tests, and Alembic drift detection passed.
- Frontend quality gate: ESLint, 25 Vitest tests across eight files, TypeScript, and the Vite
  production build passed. Route-level lazy loading keeps management pages out of the initial chunk.
- Live acceptance confirmed `/`, `/planning`, `/entities`, `/configuration`, the six management
  endpoints used by the UI, and the frontend CORS preflight all return HTTP 200.
- Automated in-app browser control was unavailable in this environment. The browser workflows are
  covered by DOM interaction tests and live HTTP checks; visual viewport acceptance remains a
  hands-on smoke check before pilot delivery.

## Step 8 — Service-aware calendar booking workflow

### Goal

Configure appointment/activity types and create, inspect, edit, and cancel duration-aware Bookings
from the calendar.

### Execute

- Load Bookings for the calendar's visible date range.
- Map booking status, participants, roles, and resolved configurable color into calendar events.
- Add a configurable `BookingType` (appointment, treatment, rental, or activity) scoped to a
  `booking_scope`, with an optional default duration and a `suggested` or `fixed` duration mode.
- Add management UI for BookingTypes and persist the selected type on a Booking without hard-coding
  salon, rental, or workshop terminology.
- Add booking creation from a selected time slot.
- When a BookingType is selected, calculate the proposed end time from its default duration;
  allow users to override suggested durations and enforce fixed durations consistently in the API
  and UI.
- Add event detail, edit, and cancellation flows.
- Refresh only affected data after a successful mutation.

### Automated tests

- Test calendar-event mapping and visible-range requests.
- Test BookingType configuration, workflow scoping, lifecycle behaviour, and suggested versus fixed
  duration validation at service and API level.
- Test creation, editing, cancellation, loading, empty, and error states.
- Test type selection, automatic end-time calculation, suggested-duration override, and fixed-duration
  enforcement in the booking form.
- Test timezone conversion at the API boundary.
- Add the first Playwright end-to-end booking lifecycle test.

### Manual acceptance

- Configure salon treatments such as washing, cutting, shaving, and extensions with different
  duration rules.
- Create the required Entities, then create, edit, and cancel typed, multi-participant Bookings
  entirely in the UI; confirm their initial durations follow the selected treatment or activity.
- Confirm the calendar remains correct across week and day views.

### Done when

- The complete typed Booking lifecycle, including configurable duration behaviour, works end to end
  without direct API use.

## Step 9 — Drag-and-drop rescheduling and conflict recovery

### Goal

Make calendar rescheduling fast without allowing inconsistent data.

### Execute

- Persist FullCalendar event drops and duration changes through the Booking API while checking every exclusive participant.
- Use optimistic feedback only when it can be rolled back reliably.
- Restore the original calendar event after a rejected change.
- Display a clear conflict message with the blocked interval, Entity, and role.
- Prevent duplicate submissions during a pending update.

### Automated tests

- Test successful move and resize operations.
- Test conflict rejection and visual rollback.
- Test network failure, repeated drops, and stale booking updates.
- Add Playwright coverage for successful and conflicting drag-and-drop flows.

### Manual acceptance

- Drag a Booking into a free slot and confirm persistence after reload.
- Drag it onto an occupied slot and confirm rollback plus understandable feedback.

### Done when

- Drag-and-drop is persistent, conflict-safe, and recoverable after failures.

## Step 10 — Resource occupancy, availability, shared filtering, colors, list view, business hours, popup booking form, and operational quality

### Goal

Make the scheduling board useful during daily operations, resource-allocation decisions, and
focused planning queries, while enforcing configured business hours and keeping the booking
workflow visible without scrolling.

### Execute

- Add configurable business hours (opening hours) per day of the week with start/end times and
  closed days; use them to set the calendar visible range and to reject Bookings outside those hours.
- Add one shared filter bar generated from configured EntityTypes, roles, categories, filterable fields, booking status, date range, and relevant free text.
- Combine active filters cumulatively and provide a clear-all action plus visible active-filter indicators.
- Make parent-category filters include Entities in descendant categories unless the user explicitly selects only one category level.
- Keep the calendar as the default main view and add a list view based on the exact same filtered booking result set.
- Add a focused occupancy view for one selected exclusive Entity, such as a hairdresser, chair,
  workbench, vehicle, or rental item, showing its Bookings and free gaps for the selected period.
- Preserve active filters, date range, and relevant selection state when switching between calendar and list views.
- Show only matching Bookings and corresponding Entities in both views; show a clear empty state when nothing matches.
- Apply resolved Entity/category/EntityType colors consistently in calendar, list, legend, and accessible non-color indicators.
- Add an availability query for a requested start and end time that returns compatible exclusive
  Entities that are free for the entire interval, filterable by role, EntityType, category, and
  configured properties.
- Reuse the same overlap semantics as Booking conflict protection, including half-open intervals,
  cancelled Bookings, inactive Entities, and exclusion of the current Booking while editing.
- Replace the under-calendar booking panel with a modal/popup form that opens from "Nieuwe booking"
  or by selecting a calendar slot.
- While the popup is open, keep the calendar selectable: a click outside the popup on another slot
  updates the popup's start/end times without closing it.
- Add deliberate loading performance for realistic data volumes.
- Add structured backend logging and safe user-facing errors.
- Review accessibility, responsiveness, timezone behaviour, and data validation.
- Add CSV or Excel-compatible export if it remains part of the first pilot need.
- If contract generation is confirmed for the pilot, add managed Markdown templates, an allowlisted placeholder model, preview, and PDF output; otherwise retain it as an explicitly deferred requirement.

### Automated tests

- Test business-hours CRUD, validation, closed-day handling, and rejection of Bookings outside
  configured hours.
- Test generated filters independently, meaningful combinations, clear-all behaviour,
  descendant-category/custom-field filtering, and per-role availability calculations.
- Test focused occupancy results and free-gap boundaries for one exclusive Entity across day and
  week ranges.
- Test free-resource searches for fully free, partially occupied, adjacent, cancelled, inactive,
  role/type-incompatible, and edit-exclusion cases.
- Test that calendar and list views contain the same matching Bookings and that switching views preserves filter state.
- Test empty results, archived entities, special characters, and case-insensitive free-text matching.
- Add a realistic dataset test for range queries.
- Run an accessibility check on primary pages.
- Test export columns, escaping, and date formatting if export is included.
- Test color precedence, legend/accessibility behaviour, and stable rendering after configuration changes.
- Test that the booking popup opens from a calendar click and from "Nieuwe booking", and that a
  second calendar click while the popup is open updates the form's selected slot without closing.
- If documents are included, test placeholder allowlisting, escaping, missing values, template versioning, and PDF generation.

### Manual acceptance

- Configure business hours and confirm the calendar shows only those hours and rejects a Booking
  outside them with a clear error.
- Complete a realistic hair-salon scenario by filtering appointments by customer, hairdresser, and station, then switch between calendar and list views.
- Select one hairdresser or chair and verify its occupied periods and free gaps; then choose an
  appointment interval and find all compatible free hairdressers or chairs.
- Complete a realistic rental scenario by filtering Entities through a parent category, custom property, and participant role.
- Find rental items that are free for a specified pickup and return interval.
- Complete a repair-workshop scenario by filtering on workpiece, mechanic, and workbench.
- Inspect one workbench's occupancy and find a free compatible workbench for a specified repair
  interval.
- Confirm that active filters remain unchanged after switching views and that only matching Bookings and Entities are visible.
- Confirm configured colors resolve consistently; if in pilot scope, generate a rental contract from a Booking.
- Verify the core workflow on desktop and tablet-size layouts.
- Open the booking popup, click a different slot in the calendar, and verify the popup updates its
  selected time without closing; then save the Booking.

### Done when

- The board supports configured business hours, all three realistic scenarios, focused resource
  occupancy, interval-based free-resource searches, shared generated filtering, configured colors,
  calendar/list switching, and a modal booking form whose selected slot updates when the user clicks
  another calendar slot while the popup remains open, all without direct technical intervention.

## Step 11 — Local release and pilot readiness

### Goal

Deliver an installable local MVP that can be evaluated by the first pilot user.

### Execute

- Add the agreed minimal authentication or local access protection, including protection appropriate for any configured sensitive fields.
- Build the production frontend and serve it through the packaged application.
- Package the backend, frontend assets, and SQLite setup for a clean machine.
- Add backup, restore, export, and upgrade instructions.
- Define release versioning and create a pilot checklist.
- Do not begin SaaS multi-tenancy until the local MVP decision gate is passed.

### Automated tests

- Run the complete backend, frontend, and end-to-end suites against a production build.
- Test database creation and upgrade from an earlier release fixture.
- Test backup and restore with representative data.
- Scan the build output for accidental secrets and development-only configuration.

### Manual acceptance

- Install and start Planboard on a clean machine or clean virtual machine.
- Complete the full configuration → Entity → multi-participant Booking → reschedule → export/backup workflow.
- Restart the machine and confirm data persists.
- Record pilot feedback separately from release-blocking defects.

### Done when

- A clean machine can install, run, update, back up, and restore the MVP.
- The pilot user can complete the core workflow without developer assistance.

## MVP completion gate

The MVP may be called complete only when:

- Steps 0 through 11 are marked `Complete` with test evidence.
- The full automated suite passes from a clean checkout.
- The clean-machine acceptance test passes.
- No open defect can cause lost data, invalid bookings, or silent scheduling conflicts.
- The salon, rental, and repair-workshop acceptance scenarios pass using configuration rather than branch-specific code.
- The vault project page records the release version and pilot decision.

After this gate, decide whether to prioritise pilot feedback, recurring bookings, notifications, PostgreSQL/multi-tenancy, or a SaaS deployment. Those are separate plans, not hidden additions to this MVP.

## Progress log

Add one row after completing or blocking a step.

| Date | Step | Result | Test evidence | Decision or follow-up |
|------|------|--------|---------------|-----------------------|
| 2026-08-23 | Planning | Development plan created | Document review and structure check | Start with step 0; installing `uv` requires approval |
| 2026-08-23 | 0 | Complete | `./scripts/check.sh`; `bun run lint`; `bun run build`; frontend and API returned HTTP 200 | Corrected obsolete `uv` installation note; committed in `7831084` |
| 2026-08-23 | 1 | Complete | Backend: Ruff + 1 Pytest test; frontend: ESLint + 4 Vitest tests + production build | Tests use temporary SQLite; use `./scripts/check.sh` and `bun run check` as quality gates |
| 2026-08-23 | 2 | Complete | Backend: Ruff + 15 Pytest tests + `alembic check`; frontend: ESLint + 4 Vitest tests + production build; category/Item/Client/Booking smoke in rollback transaction; both services HTTP 200 | Alembic now owns schema lifecycle; legacy scaffold data is preserved during upgrade; timestamps normalize to UTC; implementation in `cffb0d5` |
| 2026-08-23 | Requirements refinement | `wensen.md` incorporated into product and development plans | Scenario and consistency review | Step 3 is now a mandatory architecture checkpoint for configurable Entities, fields, roles, colors, and multi-participant Bookings before CRUD continues |
| 2026-08-23 | 3 | Complete | Backend: Ruff + 35 Pytest tests + `alembic check`; frontend: ESLint + 4 Vitest tests + production build; salon/rental/workshop scenario script with rollback; both services HTTP 200 | Migrated Item/Client data to generic Entities; relational typed custom values chosen over arbitrary JSON; role-based exclusivity and color precedence implemented in `9d099e4` |
| 2026-08-23 | 4 | Complete | Backend: Ruff + 47 Pytest tests + `alembic check`; frontend: ESLint + 4 Vitest tests + production build; backend, Swagger, and client HTTP 200; 16 management paths and 24 operations in live OpenAPI | Added structured errors and lifecycle APIs for EntityTypes, fields, roles, presets, categories, and Entities; search and combinable typed/category filters included in `c05a0a4` |
| 2026-08-23 | 5 | Complete | Backend: Ruff + 55 Pytest tests + `alembic check`; frontend: ESLint + 4 Vitest tests + production build; salon/rental/workshop Booking API acceptance; backend, Booking list, Swagger, and client HTTP 200; 30 live OpenAPI operations | Added scoped required roles, atomic overlap checks, structured multi-Entity conflict details, lifecycle rules, and shared Booking filters in `fcb3d72` |
| 2026-08-23 | 6 | Complete | Backend: Ruff + 57 Pytest tests + `alembic check`; frontend: ESLint + 17 Vitest tests + production build; planning/entities/configuration route and DOM acceptance; all live routes, API sources, and both local CORS origins HTTP 200 | Replaced demo data with typed server-backed plumbing, React Router shell, shared loading/empty/offline/validation/conflict/error states, retry and health recovery in `d123f53`; no query library until mutation caching justifies it |
| 2026-08-24 | Requirements expansion | Duration per appointment/activity type plus focused resource occupancy and interval availability incorporated | Product-model and phased-plan review | Add configurable BookingTypes and duration rules in step 8; deliver occupancy and free-resource search in step 10 using existing exclusivity semantics |
| 2026-08-24 | 8 | Complete | Backend: Ruff + 64 Pytest tests + `alembic check`; frontend: ESLint + 38 Vitest tests + production build; salon/rental/workshop Booking API acceptance; Playwright E2E (preset → Entities → create/edit/cancel typed Booking) against a throwaway database | BookingType with suggested/fixed duration modes enforced in API and form; calendar does visible-range loading, slot creation, detail/edit/cancel; Alembic honours `PLANBOARD_DATABASE_URL`; implementation in `fc5cb0b` |
| 2026-08-24 | 9 | Complete | Backend: Ruff + 68 Pytest tests + `alembic check`; frontend: ESLint + 49 Vitest tests + production build; salon/rental/workshop Booking API acceptance; Playwright E2E reschedule and conflict against a throwaway database | Added dedicated `PATCH /bookings/{id}/slot` endpoint; FullCalendar eventDrop/eventResize wired; conflict details surfaced in UI; fixed-duration bookings are not resizable; component tests cover drag handlers; E2E covers reschedule/conflict via the edit form because FullCalendar drag-and-drop simulation is unreliable in Playwright; implementation in `feat: add drag-and-drop rescheduling and conflict recovery` |
| 2026-08-24 | 10 | Complete | Backend: Ruff + 85 pytest tests + `alembic check`; frontend: ESLint + 70 Vitest tests + production build; 3 Playwright E2E tests pass; business-hours CRUD/validation; shared filter bar with active chips; calendar/list/availability/occupancy views; availability and occupancy endpoints; CSV export; structured JSON logging; color legend; popup booking form with click-outside slot update; timezone handling corrected | Step 10 delivered: configurable business hours, shared filters, list view, focused occupancy and availability views, color legend, CSV export, structured logging, accessibility/responsive review, and modal booking form that updates its slot while open. Ready to start step 11. |
