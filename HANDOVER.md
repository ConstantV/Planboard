# Planboard handover

Last updated: 2026-08-24  
Repository: `https://github.com/ConstantV/Planboard.git`  
Branch: `main`  
Last pushed commit: step-9 implementation `feat: add drag-and-drop rescheduling and conflict recovery`
followed by the step-9 documentation commit

## 1. Read this first

Planboard is complete through **development step 10**. The next implementation increment is
**step 11 — Local release and pilot readiness**.
Do not start step 11 before step 10 passes its complete test and acceptance gate.

The authoritative documents are:

1. [`docs/development-plan.md`](docs/development-plan.md) — phased scope, acceptance criteria,
   evidence, and commit mapping.
2. [`docs/architecture.md`](docs/architecture.md) — domain and technical decisions.
3. [`wensen.md`](wensen.md) — original user scenarios and product wishes.
4. [`docs/gebruikershandleiding.md`](docs/gebruikershandleiding.md) — Dutch configuration and user
   guide with salon, rental, and workshop examples.
5. `MyVault/01. Projects/Planboard/Planboard.md` — LifeOS source project file outside this repo.

## 2. Important workspace state

At handover time, the tracked repository is synchronized with `origin/main` at the step-10
implementation and documentation commits.

There is one untracked file:

```text
docs/gebruikershandleiding.pdf
```

This PDF is user-owned work:

- do not delete or overwrite it;
- do not add it to a commit without first deciding whether generated PDFs belong in Git;
- check `git status --short` before every commit.

## 3. Product objective and core requirements

Planboard is a configurable single-user planning application for multiple industries. The same
generic domain must support at least:

- salon: customer + hairdresser + optional chair;
- rental: customer + rental item + optional employee;
- repair workshop: workpiece + mechanic + workbench.

Key user requirements already recorded in the plan:

- calendar remains the primary view;
- a later list view must use the exact same active booking filters;
- filters must combine cumulatively across customers, employees, items, stations, categories,
  booking status, date range, and configured fields;
- categories may be hierarchical and parent filtering includes descendants;
- a Booking may contain multiple role-bound Entities;
- exclusivity is configurable per planning role;
- calendar colors are configurable with deterministic precedence;
- recurring Bookings, notifications, payments, Gantt/route views, and multi-tenancy are outside the
  current MVP increments.

## 4. Completed work

### Steps 0–2 — foundation and persisted model

- Reproducible Python 3.12/`uv` backend and Bun frontend setup.
- FastAPI, SQLAlchemy, Pydantic, SQLite, Alembic, React, TypeScript, React Router, and FullCalendar.
- Isolated backend tests, frontend Vitest/Testing Library tests, lint/build scripts, and migration
  drift checks.
- Timezone-aware Booking intervals and database lifecycle rules.

Key commits: `7831084`, `cffb0d5`, `df94d4c`.

### Step 3 — configurable planning domain

- Generalized legacy Item/Client scheduling to:
  - `EntityType`
  - `FieldDefinition`
  - `Entity`
  - `EntityFieldValue`
  - `EntityCategory`
  - `RoleDefinition`
  - `BookingParticipant`
  - `Booking`
- Custom values use relational datatype-specific columns for text/select, number, boolean, and
  date. JSON is limited to select-option configuration.
- Required roles are grouped by `booking_scope`.
- Color precedence is Entity → category → EntityType → `#3788D8`.
- Existing legacy data is migrated and rollback is guarded against lossy downgrade.

Key commits: `9d099e4`, `1e799ac`.

### Step 4 — management API

- CRUD/lifecycle API for EntityTypes, FieldDefinitions, RoleDefinitions, presets, categories, and
  Entities.
- Records with history are deactivated/archived rather than hard-deleted.
- Entity queries support free text, type, category descendants, active state, and configured typed
  filters.
- Category cycles are rejected.
- Structured API errors expose stable code, message, and optional details.

Key commits: `c05a0a4`, `fcb09cd`.

### Step 5 — multi-entity Booking API

- Create, read, list, update, cancel, and guarded delete endpoints.
- A Booking contains multiple Entities through configured roles.
- Required role/cardinality validation is scoped by `booking_scope`.
- Exclusive participants receive overlap protection; cancelled Bookings do not block time.
- Half-open intervals allow adjacent Bookings.
- SQLite uses `BEGIN IMMEDIATE` to make conflict check + write atomic; databases with row locking
  lock involved Entity rows.
- Booking list filters support interval, EntityType, Entity, role, category descendants, status,
  configured fields, and free text.

Key commits: `fcb3d72`, `8c8c70d`.

### Step 6 — frontend shell and API integration

- Routes:
  - `/planning`
  - `/entities`
  - `/configuration`
- Typed API clients for configuration, Entities, categories, and Bookings.
- Shared loading, empty, retry, offline, validation, conflict, and server-error states.
- Recovering API connectivity indicator.
- FullCalendar renders server-provided Booking data; hard-coded demo data was removed.
- Page routes are lazy-loaded, separating FullCalendar from management page bundles.

Key commits: `d123f53`, `743dd2d`.

### Step 7 — Entity and configuration UI

- Configuration UI for all three presets, EntityTypes, colors, custom fields, planning roles,
  cardinality, and exclusivity.
- Dynamic Entity forms for text, number, boolean, date, and select fields.
- Entity create/edit/archive, category assignment, custom color, free search, type/category/archive,
  and configured custom-field filters.
- Category-tree create, rename, move, color, and archive workflows.
- UI excludes the current category and descendants as possible parents; backend remains the
  authoritative cycle guard.
- Accessible labels, keyboard-operable controls, field validation, confirmations, success notices,
  and normalized API feedback.

Key commits: `608fc0a`, `fbdf151`.

### Step 8 — service-aware calendar booking workflow

- `BookingType` model: scoped per `booking_scope`, optional positive default duration in minutes,
  and a `suggested` or `fixed` duration mode; `GET/POST/PATCH /api/booking-types` plus deactivate;
  key and scope are immutable once Bookings reference the type.
- `Booking.booking_type_id` (nullable, `ON DELETE SET NULL`) with serialization on every Booking
  response; create/update validate scope match, active type, and exact fixed duration.
- Presets install sensible BookingTypes (hair salon: wassen/knippen/scheren/extensions; rental:
  verhuur; workshop: diagnose/reparatie).
- Configuration page manages BookingTypes with duration chips and archive actions.
- Planning page loads Bookings for FullCalendar's visible range via `datesSet`, supports slot
  selection and header-button creation, derives participant selectors from scope roles, shows
  detail/edit/cancel flows, and renders structured conflict details from the API.
- Booking form auto-calculates the end time from the selected type: suggested durations stay
  editable, fixed durations lock the end input and recompute on start changes.
- First Playwright end-to-end suite (`bun run test:e2e` in `frontend/`): installs the salon
  preset, creates Entities, and drives create → inspect → edit → cancel against a throwaway
  SQLite database on ports 8011/5179. `alembic/env.py` honours `PLANBOARD_DATABASE_URL` so tests
  and E2E never touch the development database.

Key commit: `fc5cb0b`.

### Step 9 — drag-and-drop rescheduling and conflict recovery

- Dedicated `PATCH /api/bookings/{booking_id}/slot` endpoint accepts only `start_at`/`end_at`,
  reuses existing participant resolution, BookingType duration validation, and conflict detection,
  and returns the standard structured 409 conflict details.
- `frontend/src/components/ScheduleCalendar.tsx` enables FullCalendar `eventDrop` and
  `eventResize` and forwards booking ID, new interval, and FullCalendar's `revert` callback.
- `frontend/src/pages/PlanningPage.tsx` calls the slot endpoint through the existing mutation
  hook, reloads the visible range on success, and invokes `revert()` on failure so the calendar
  event snaps back. Mutation errors are now surfaced on the planning page itself, not only inside
  the detail/edit panel.
- `frontend/src/mappers/booking.ts` sets `durationEditable: false` for fixed-duration
  BookingTypes; the backend remains the authoritative guard.
- `MutationFeedback` renders conflict details with blocked interval, Entity, and role.
- Component tests cover drag/resize forwarding, the editable prop, fixed-duration
  `durationEditable`, and the PlanningPage drop/resize/error paths. The E2E suite validates
  reschedule and conflict end-to-end through the edit form because FullCalendar's native
  drag-and-drop simulation proved unreliable under Playwright's mouse events; the actual
  drag-and-drop handlers are unit-tested.

Key commit: to be created.

### Step 10 — occupancy, availability, shared filters, list view, colors, export, and operational quality

- Configurable business hours per day of week, with API validation rejecting Bookings outside open
  hours and a frontend configuration UI; calendar visible range derives from opening hours.
- Modal booking form that opens from “Nieuwe booking” or a calendar slot selection; the calendar
  remains clickable while the popup is open, and selecting another slot updates the form's start/end
  without closing.
- Shared filter bar generated from EntityTypes, roles, categories, status, date range, and free text;
  cumulative filtering with active chips and clear-all; filters persist when switching views.
- Calendar and list views render the same filtered booking result set; list view shows status chips,
  participant color dots, and click-to-detail.
- Availability endpoint `GET /api/availability` returns exclusive Entities that are free for a requested
  interval, with role/type/category filters and edit-exclusion support.
- Occupancy endpoint `GET /api/entities/{entity_id}/occupancy` returns an Entity's Bookings and free
  gaps within business hours for a date range.
- Color legend panel and consistent resolved-color application in calendar, list, and detail views.
- CSV export `GET /api/bookings/export.csv` with UTF-8 BOM for Excel compatibility.
- Structured JSON backend logging with `PLANBOARD_LOG_JSON` and `PLANBOARD_LOG_LEVEL` environment
  controls; booking mutations and conflicts are logged.
- Accessibility and responsiveness review: focus management in the modal, keyboard-operable list rows,
  `aria-labels`, and responsive filter bar and table layouts.
- Timezone handling corrected so that `datetime-local` values are sent with a local offset, keeping
  wall-clock times consistent with configured business hours.
- Backend tests cover availability, occupancy, business hours, and CSV export; frontend tests cover
  the filter bar, list view, panels, legend, and datetime helpers; E2E suite still passes end-to-end.

Key commits: to be created.

### Documentation

- Development plan and architecture updated after every completed step.
- Dutch, PDF-ready user guide added with four SVG screen illustrations and extensive configuration
  examples.

Key commits: `b91a883` (step 8), step-9 docs commit to be created.

## 5. Current quality evidence

Last complete gate result:

- Backend: **85/85 tests passed**, Ruff/checks passed, Alembic drift check passed.
- Frontend: **70/70 tests across 17 files passed**, ESLint passed, TypeScript passed, Vite
  production build passed.
- Playwright E2E: **3/3 tests passed** (booking lifecycle, reschedule persistence, conflict
  feedback) against an isolated throwaway database.
- Three-domain Booking API acceptance passed (hair salon, rental, repair workshop).

Run the gates again before the first step-9 change and before committing:

```bash
cd backend
./scripts/check.sh

cd ../frontend
bun run check
```

Run the three-domain Booking API acceptance when Booking behavior changes:

```bash
cd backend
uv run python -m scripts.verify_booking_api
```

Run the browser-level lifecycle test when calendar or booking behavior changes:

```bash
cd frontend
bun run test:e2e
```

## 6. Starting the application

Backend:

```bash
cd backend
cp .env.example .env            # only if .env does not exist
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Frontend, in another terminal:

```bash
cd frontend
cp .env.example .env            # only if .env does not exist
bun install
bun run dev
```

URLs:

- frontend: `http://localhost:5173`
- API: `http://localhost:8000/api`
- health: `http://localhost:8000/api/health`
- OpenAPI UI: `http://localhost:8000/docs`

Local configuration defaults:

```text
PLANBOARD_DATABASE_URL=sqlite:///./planboard.db
PLANBOARD_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_BASE_URL=http://localhost:8000/api
```

The local development database observed during the last session contains the salon, rental, and
repair-workshop preset definitions plus migrated legacy Client/Item definitions. At that moment the
Entity and category lists were empty. Treat this as mutable development state, not a fixture or
test assumption.

## 7. Architecture map

### Backend

| Responsibility | Main files |
|---|---|
| App/router/error envelope | `backend/app/main.py`, `backend/app/api/router.py`, `backend/app/api/errors.py` |
| Configuration API | `backend/app/api/routes/configuration.py` |
| Entity/category API | `backend/app/api/routes/entities.py`, `categories.py` |
| Booking API | `backend/app/api/routes/bookings.py` |
| BookingType API | `backend/app/api/routes/booking_types.py` |
| Availability/occupancy API | `backend/app/api/routes/availability.py` |
| Business-hours API | `backend/app/api/routes/business_hours.py` |
| Models | `backend/app/models/` |
| API schemas | `backend/app/schemas/` |
| Entity validation/filtering | `backend/app/services/entity_service.py` |
| Booking roles/conflicts/querying | `backend/app/services/booking_service.py` |
| Availability/occupancy | `backend/app/services/availability_service.py` |
| Business hours | `backend/app/services/business_hours_service.py` |
| Logging | `backend/app/core/logging.py` |
| Presets | `backend/app/services/presets.py` |
| Tests | `backend/tests/` |

### Frontend

| Responsibility | Main files |
|---|---|
| Routing/app shell | `frontend/src/App.tsx`, `components/AppShell.tsx` |
| API client/error kinds | `frontend/src/api/client.ts` |
| Booking API | `frontend/src/api/bookings.ts` |
| Planning page | `frontend/src/pages/PlanningPage.tsx` |
| FullCalendar wrapper | `frontend/src/components/ScheduleCalendar.tsx` |
| Booking form/details/modal | `frontend/src/components/booking/BookingForm.tsx`, `BookingDetails.tsx`, `BookingModal.tsx` |
| Filter bar, list, legend, panels | `frontend/src/components/booking/FilterBar.tsx`, `BookingList.tsx`, `ColorLegend.tsx`, `OccupancyPanel.tsx`, `AvailabilityPanel.tsx` |
| BookingType API client | `frontend/src/api/bookingTypes.ts` |
| Availability API client | `frontend/src/api/availability.ts` |
| Business-hours API client | `frontend/src/api/businessHours.ts` |
| Booking → event mapping | `frontend/src/mappers/booking.ts` |
| Playwright E2E | `frontend/e2e/`, `frontend/playwright.config.ts` |
| Entity management | `frontend/src/pages/EntitiesPage.tsx`, `components/management/EntityForm.tsx` |
| Configuration management | `frontend/src/pages/ConfigurationPage.tsx`, `components/management/` |
| Shared async/mutation states | `frontend/src/hooks/`, `components/PageState.tsx`, `MutationFeedback.tsx` |
| API types | `frontend/src/types/api.ts` |

## 8. Existing Booking frontend contract

The typed frontend client exposes:

- `listBookings(filters)` with `range_start`/`range_end` for visible-range loading
- `getBooking(id)`
- `createBooking(input)`
- `updateBooking(id, input)`
- `cancelBooking(id)`
- `deleteBooking(id)`

`bookingToEvent()` maps:

- Booking ID;
- participant names into the title;
- start/end timestamps;
- resolved color from the first exclusive participant, falling back to the first participant;
- cancelled status into a CSS class;
- status, notes, participants, and the BookingType into `extendedProps`.

The Planning page wires FullCalendar through `ScheduleCalendar` callbacks: `datesSet` drives
visible-range reloads, `select` opens a prefilled create form, and `eventClick` opens the detail
panel with edit and cancel actions. `BookingForm` validates scope, interval, required roles, and
BookingType duration rules before submitting; `BookingDetails` renders participants, interval,
type/duration, status, and notes.

## 9. Next increment: step 11 — local release and pilot readiness

### Goal

Package the MVP as an installable local application that can be evaluated by the first pilot user.

### Required behavior

1. Add the agreed minimal authentication or local access protection appropriate for the single-user
   MVP and any configured sensitive fields.
2. Build the production frontend and serve it through the packaged application.
3. Package the backend, frontend assets, and SQLite setup for a clean machine.
4. Add backup, restore, export, and upgrade instructions.
5. Define release versioning and create a pilot checklist.
6. Do not begin SaaS multi-tenancy until the local MVP decision gate is passed.

### Automated tests required by the plan

- Run the complete backend, frontend, and end-to-end suites against a production build.
- Test database creation and upgrade from an earlier release fixture.
- Test backup and restore with representative data.
- Scan the build output for accidental secrets and development-only configuration.

### Definition of done

- A clean machine can install, run, update, back up, and restore the MVP.
- The pilot user can complete the core workflow without developer assistance.
- Backend and frontend full gates pass.
- `docs/development-plan.md`, `docs/architecture.md`, LifeOS project note, and this handover are
  updated; implementation and documentation are committed separately and pushed to `origin/main`.

## 10. Known limitations and cautions

- Shared occupancy views, free-resource search, and calendar/list filters are intentionally step 10.
- BookingType key and booking scope cannot change while Bookings reference the type (HTTP 422);
  archive such types instead.
- A fixed-duration BookingType without a duration is rejected everywhere; the API remains
  authoritative when the form is bypassed.
- Authentication/authorization and multi-tenancy are not part of the single-user MVP.
- Sensitive identity fields are intentionally absent pending explicit security, access, encryption,
  retention, export, and deletion decisions.
- Automated control of the in-app “Claude” browser tab was unavailable because the browser service
  rejected the connection. The step-8 UI is now covered by the Playwright suite, but a human
  visual/mobile smoke check remains useful.
- The user guide currently uses four clearly labelled SVG interface reconstructions rather than
  captured browser screenshots. Replace them later when browser automation is available.
- Existing UI copy sometimes uses `entiteitType` capitalization. This is cosmetic and can be
  standardized to Dutch `entiteittype` when touching the relevant copy.

## 11. Git and delivery discipline

Before every commit:

```bash
git remote -v
git status --short
git diff --check
```

Preserve unrelated or user-owned working-tree changes, especially
`docs/gebruikershandleiding.pdf`. Run a secret scan before pushing. The expected remote is:

```text
origin  https://github.com/ConstantV/Planboard.git
```

The established commit pattern is:

1. implementation commit, for example `feat: add ...`;
2. documentation/progress commit, for example `docs: complete development step 8`;
3. push both only after all gates and acceptance checks pass.

## 12. Suggested opening prompt for the next session

```text
Open HANDOVER.md and docs/development-plan.md. Continue Planboard with step 10 only: build shared
filtering, calendar/list switching, focused resource occupancy, and free-resource availability,
including generated filters, cumulative filter state, parent-category descendant inclusion,
consistent color resolution, accessibility review, backend logging, export if in pilot scope, frontend
and backend tests, isolated Playwright E2E, full quality gates, documentation, separate commits, and
push. Preserve the untracked docs/gebruikershandleiding.pdf and do not start step 11 release
readiness before step 10 passes all gates.
```

