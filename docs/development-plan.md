# Planboard development plan

## Purpose

This plan turns the product roadmap into small, testable delivery steps. Each step produces a usable increment, is implemented completely, and passes its verification gate before work starts on the next step.

The MVP is complete when an administrator can configure planning-entity types and fields, a user can maintain categorized entities, Bookings can connect multiple role-based entities, exclusive resources cannot be double-booked, and calendar/list views share filters and configurable colors.

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
- `exclusive`: a role/type setting that determines whether overlap protection applies to an Entity.
- Configurable calendar colors with precedence: Entity, then category, then EntityType, then the application default.

Custom values use a hybrid approach: definitions and query-critical core fields remain relational; flexible values may use validated JSON. Step 3 must prove filtering and migration behaviour in SQLite and document a PostgreSQL-compatible path before accepting this choice. Identity-document fields are not part of the default model and require an explicit privacy/security decision.

## Progress overview

| Step | Deliverable | Status | Test evidence | Commit |
|------|-------------|--------|---------------|--------|
| 0 | Reproducible local environment | Complete | Backend check; frontend lint/build; live HTTP checks | `7831084` |
| 1 | Test infrastructure and CI-ready quality gates | Complete | Backend: 1 test; frontend: 4 tests; both full checks pass | `7831084` |
| 2 | Database migrations and validated domain model | Complete | Backend: Ruff + 15 tests + Alembic drift check; frontend: lint + 4 tests + build; manual domain smoke | `cffb0d5` |
| 3 | Configurable entity model and admin contract | In progress | — | — |
| 4 | Entity and category management API | Planned | — | — |
| 5 | Multi-entity Booking API and conflict protection | Planned | — | — |
| 6 | Frontend application shell and API integration | Planned | — | — |
| 7 | Entity and configuration user interface | Planned | — | — |
| 8 | Calendar booking workflow | Planned | — | — |
| 9 | Drag-and-drop rescheduling and conflict recovery | Planned | — | — |
| 10 | Availability, shared filtering, colors, list view, and operational quality | Planned | — | — |
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

- Test every endpoint's success and authorization-scope path.
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

## Step 8 — Calendar booking workflow

### Goal

Create, inspect, edit, and cancel bookings from the calendar.

### Execute

- Load Bookings for the calendar's visible date range.
- Map booking status, participants, roles, and resolved configurable color into calendar events.
- Add booking creation from a selected time slot.
- Add event detail, edit, and cancellation flows.
- Refresh only affected data after a successful mutation.

### Automated tests

- Test calendar-event mapping and visible-range requests.
- Test creation, editing, cancellation, loading, empty, and error states.
- Test timezone conversion at the API boundary.
- Add the first Playwright end-to-end booking lifecycle test.

### Manual acceptance

- Create the required Entities, then create, edit, and cancel a multi-participant Booking entirely in the UI.
- Confirm the calendar remains correct across week and day views.

### Done when

- The complete booking lifecycle works end to end without direct API use.

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

## Step 10 — Availability, shared filtering, colors, list view, and operational quality

### Goal

Make the scheduling board useful during daily operations and for focused planning queries.

### Execute

- Add one shared filter bar generated from configured EntityTypes, roles, categories, filterable fields, booking status, date range, and relevant free text.
- Combine active filters cumulatively and provide a clear-all action plus visible active-filter indicators.
- Make parent-category filters include Entities in descendant categories unless the user explicitly selects only one category level.
- Keep the calendar as the default main view and add a list view based on the exact same filtered booking result set.
- Preserve active filters, date range, and relevant selection state when switching between calendar and list views.
- Show only matching Bookings and corresponding Entities in both views; show a clear empty state when nothing matches.
- Apply resolved Entity/category/EntityType colors consistently in calendar, list, legend, and accessible non-color indicators.
- Show availability for configured exclusive Entities in the selected date range.
- Add deliberate loading performance for realistic data volumes.
- Add structured backend logging and safe user-facing errors.
- Review accessibility, responsiveness, timezone behaviour, and data validation.
- Add CSV or Excel-compatible export if it remains part of the first pilot need.
- If contract generation is confirmed for the pilot, add managed Markdown templates, an allowlisted placeholder model, preview, and PDF output; otherwise retain it as an explicitly deferred requirement.

### Automated tests

- Test generated filters independently, meaningful combinations, clear-all behaviour, descendant-category/custom-field filtering, and per-role availability calculations.
- Test that calendar and list views contain the same matching Bookings and that switching views preserves filter state.
- Test empty results, archived entities, special characters, and case-insensitive free-text matching.
- Add a realistic dataset test for range queries.
- Run an accessibility check on primary pages.
- Test export columns, escaping, and date formatting if export is included.
- Test color precedence, legend/accessibility behaviour, and stable rendering after configuration changes.
- If documents are included, test placeholder allowlisting, escaping, missing values, template versioning, and PDF generation.

### Manual acceptance

- Complete a realistic hair-salon scenario by filtering appointments by customer, hairdresser, and station, then switch between calendar and list views.
- Complete a realistic rental scenario by filtering Entities through a parent category, custom property, and participant role.
- Complete a repair-workshop scenario by filtering on workpiece, mechanic, and workbench.
- Confirm that active filters remain unchanged after switching views and that only matching Bookings and Entities are visible.
- Confirm configured colors resolve consistently; if in pilot scope, generate a rental contract from a Booking.
- Verify the core workflow on desktop and tablet-size layouts.

### Done when

- The board supports all three realistic scenarios, shared generated filtering, configured colors, and calendar/list switching without direct technical intervention.

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
