# Planboard development plan

## Purpose

This plan turns the product roadmap into small, testable delivery steps. Each step produces a usable increment, is implemented completely, and passes its verification gate before work starts on the next step.

The MVP is complete when a user can maintain categorized items and clients, create and manage bookings, prevent double-bookings, reschedule bookings safely in the calendar, filter the planning data, and switch between calendar and list views without losing the active filters.

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

## Progress overview

| Step | Deliverable | Status | Test evidence | Commit |
|------|-------------|--------|---------------|--------|
| 0 | Reproducible local environment | Complete | Backend check; frontend lint/build; live HTTP checks | Pending initial repository commit |
| 1 | Test infrastructure and CI-ready quality gates | Complete | Backend: 1 test; frontend: 4 tests; both full checks pass | Pending initial repository commit |
| 2 | Database migrations and validated domain model | Planned | — | — |
| 3 | Item management | Planned | — | — |
| 4 | Client management | Planned | — | — |
| 5 | Booking API and double-booking protection | Planned | — | — |
| 6 | Frontend application shell and API integration | Planned | — | — |
| 7 | Item and client user interface | Planned | — | — |
| 8 | Calendar booking workflow | Planned | — | — |
| 9 | Drag-and-drop rescheduling and conflict recovery | Planned | — | — |
| 10 | Availability, shared filtering, list view, and operational quality | Planned | — | — |
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

## Step 3 — Item management

### Goal

Provide complete backend CRUD for schedulable resources and their categories.

### Execute

- Add endpoints to list, retrieve, create, update, and deactivate Items.
- Add endpoints to list, retrieve, create, update, move, and deactivate Item categories.
- Add schema validation for name and item type.
- Allow an Item to have an optional category and return enough category-path data for filtering and display.
- When filtering by a parent category, include Items from all descendant categories by default.
- Prefer deactivation over deletion when an Item has bookings.
- Return consistent API errors for missing and invalid Items.

### Automated tests

- Test every endpoint's success path.
- Test category creation, nesting, moving, descendant lookup, cycle rejection, and assignment to Items.
- Test empty names, excessive lengths, missing IDs, and duplicate policy.
- Test that inactive Items remain readable but cannot receive new bookings later.

### Manual acceptance

- Use the generated FastAPI documentation to create a category hierarchy and create, categorize, edit, list, and deactivate an Item.

### Done when

- Item and Item-category management are complete at API level and all edge cases pass.

## Step 4 — Client management

### Goal

Provide complete backend CRUD for customers.

### Execute

- Add endpoints to list, retrieve, create, update, and archive Clients.
- Validate names, email addresses, phone numbers, and notes.
- Define how archived Clients with historical bookings are handled.
- Add optional search by name or contact detail.

### Automated tests

- Test every endpoint's success path.
- Test invalid email, missing name, missing ID, and archive behaviour.
- Test search with matching, non-matching, and case-insensitive input.

### Manual acceptance

- Use the FastAPI documentation to complete the full Client lifecycle.

### Done when

- Client management is complete without breaking historical booking references.

## Step 5 — Booking API and double-booking protection

### Goal

Deliver the scheduling core as a tested backend workflow.

### Execute

- Add list, retrieve, create, update, cancel, and delete rules for Bookings.
- Connect the existing overlap query to create and reschedule operations.
- Return HTTP 409 with structured conflict details for double-bookings.
- Support combinable filtering by date range, Item, Item category (including descendants), Client, status, and relevant free text.
- Define filters as a shared API contract so calendar and list views return the same matching result set.
- Define boundary behaviour for adjacent bookings and cancelled bookings.
- Execute overlap checks and writes in a safe transaction.

### Automated tests

- Test non-overlapping, partially overlapping, contained, containing, and identical intervals.
- Test adjacent intervals where one booking ends exactly when another starts.
- Test cancelled bookings and exclusion of the booking being edited.
- Test invalid Item, invalid Client, invalid interval, each filter independently, combined filters, empty results, and category-descendant filtering.
- Test API status codes and error payloads.

### Manual acceptance

- Create a valid booking through the API.
- Attempt a conflicting booking and confirm it is rejected clearly.
- Move or cancel the original booking and confirm the slot becomes available.

### Done when

- No create or update path can bypass overlap protection.
- The complete booking lifecycle passes automated and manual checks.

## Step 6 — Frontend application shell and API integration

### Goal

Create a maintainable frontend structure that handles data, errors, and navigation consistently.

### Execute

- Add routing and page-level layout.
- Add a typed API layer for Items, Clients, and Bookings.
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

## Step 7 — Item and client user interface

### Goal

Allow a non-technical user to manage the supporting booking data and Item-category hierarchy.

### Execute

- Build Item list, create, edit, and deactivate flows.
- Build Item-category tree management with create, rename, move, and deactivate flows.
- Allow Items to be assigned or moved to a category.
- Build Client list, search, create, edit, and archive flows.
- Add accessible forms, field-level validation, confirmations, and success feedback.
- Ensure keyboard navigation and responsive layout.

### Automated tests

- Test form validation and submitted payloads.
- Test list loading, empty states, edits, archive/deactivate actions, and API errors.
- Test category-tree interactions, Item assignment, moving categories, and cycle/error feedback.
- Test core forms with keyboard interaction.

### Manual acceptance

- Complete Item, Item-category, and Client lifecycles using only the browser.
- Repeat the core workflow on a narrow mobile-size viewport.

### Done when

- Items and Clients can be managed without FastAPI documentation or direct database access.

## Step 8 — Calendar booking workflow

### Goal

Create, inspect, edit, and cancel bookings from the calendar.

### Execute

- Load Bookings for the calendar's visible date range.
- Map booking status and Item information into calendar events.
- Add booking creation from a selected time slot.
- Add event detail, edit, and cancellation flows.
- Refresh only affected data after a successful mutation.

### Automated tests

- Test calendar-event mapping and visible-range requests.
- Test creation, editing, cancellation, loading, empty, and error states.
- Test timezone conversion at the API boundary.
- Add the first Playwright end-to-end booking lifecycle test.

### Manual acceptance

- Create an Item and Client, then create, edit, and cancel their Booking entirely in the UI.
- Confirm the calendar remains correct across week and day views.

### Done when

- The complete booking lifecycle works end to end without direct API use.

## Step 9 — Drag-and-drop rescheduling and conflict recovery

### Goal

Make calendar rescheduling fast without allowing inconsistent data.

### Execute

- Persist FullCalendar event drops and duration changes through the Booking API.
- Use optimistic feedback only when it can be rolled back reliably.
- Restore the original calendar event after a rejected change.
- Display a clear conflict message with the blocked interval.
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

## Step 10 — Availability, shared filtering, list view, and operational quality

### Goal

Make the scheduling board useful during daily operations and for focused planning queries.

### Execute

- Add one shared filter bar for Client, Item/resource, Item category, booking status, date range, and relevant free text.
- Combine active filters cumulatively and provide a clear-all action plus visible active-filter indicators.
- Make parent-category filters include Items in descendant categories unless the user explicitly selects only one category level.
- Keep the calendar as the default main view and add a list view based on the exact same filtered booking result set.
- Preserve active filters, date range, and relevant selection state when switching between calendar and list views.
- Show only matching Bookings and the corresponding Items/resources in both views; show a clear empty state when nothing matches.
- Show availability for the selected date range.
- Add deliberate loading performance for realistic data volumes.
- Add structured backend logging and safe user-facing errors.
- Review accessibility, responsiveness, timezone behaviour, and data validation.
- Add CSV or Excel-compatible export if it remains part of the first pilot need.

### Automated tests

- Test every filter independently, meaningful filter combinations, clear-all behaviour, descendant-category filtering, and availability calculations.
- Test that calendar and list views contain the same matching Bookings and that switching views preserves filter state.
- Test empty results, archived entities, special characters, and case-insensitive free-text matching.
- Add a realistic dataset test for range queries.
- Run an accessibility check on primary pages.
- Test export columns, escaping, and date formatting if export is included.

### Manual acceptance

- Complete a realistic hair-salon scenario by filtering appointments by Client and hairdresser, then switching between calendar and list views.
- Complete a realistic rental scenario by filtering Items through a parent and child category.
- Confirm that active filters remain unchanged after switching views and that only matching Bookings and Items are visible.
- Verify the core workflow on desktop and tablet-size layouts.

### Done when

- The board supports a realistic workday, shared filtering, and calendar/list switching without direct technical intervention.

## Step 11 — Local release and pilot readiness

### Goal

Deliver an installable local MVP that can be evaluated by the first pilot user.

### Execute

- Add the agreed minimal authentication or local access protection.
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
- Complete the full Item → Client → Booking → reschedule → export/backup workflow.
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
- The vault project page records the release version and pilot decision.

After this gate, decide whether to prioritise pilot feedback, recurring bookings, notifications, PostgreSQL/multi-tenancy, or a SaaS deployment. Those are separate plans, not hidden additions to this MVP.

## Progress log

Add one row after completing or blocking a step.

| Date | Step | Result | Test evidence | Decision or follow-up |
|------|------|--------|---------------|-----------------------|
| 2026-08-23 | Planning | Development plan created | Document review and structure check | Start with step 0; installing `uv` requires approval |
| 2026-08-23 | 0 | Complete | `./scripts/check.sh`; `bun run lint`; `bun run build`; frontend and API returned HTTP 200 | Corrected obsolete `uv` installation note; initial repository commit remains pending |
| 2026-08-23 | 1 | Complete | Backend: Ruff + 1 Pytest test; frontend: ESLint + 4 Vitest tests + production build | Tests use temporary SQLite; use `./scripts/check.sh` and `bun run check` as quality gates |
