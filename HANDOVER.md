# Planboard handover

Last updated: 2026-08-24  
Repository: `https://github.com/ConstantV/Planboard.git`  
Branch: `main`  
Last pushed commit: step-8 implementation `fc5cb0b feat: add service-aware calendar booking workflow`
followed by the step-8 documentation commit

## 1. Read this first

Planboard is complete through **development step 8**. The next implementation increment is
**step 9 — Drag-and-drop rescheduling and conflict recovery**. Do not start step 10 shared
occupancy/availability filtering before step 9 passes its complete test and acceptance gate.

The authoritative documents are:

1. [`docs/development-plan.md`](docs/development-plan.md) — phased scope, acceptance criteria,
   evidence, and commit mapping.
2. [`docs/architecture.md`](docs/architecture.md) — domain and technical decisions.
3. [`wensen.md`](wensen.md) — original user scenarios and product wishes.
4. [`docs/gebruikershandleiding.md`](docs/gebruikershandleiding.md) — Dutch configuration and user
   guide with salon, rental, and workshop examples.
5. `MyVault/01. Projects/Planboard/Planboard.md` — LifeOS source project file outside this repo.

## 2. Important workspace state

At handover time, the tracked repository is synchronized with `origin/main` at the step-8
implementation commit `fc5cb0b` and its follow-up documentation commit.

There is one untracked file:

```text
docs/gebruikershandleiding.pdf
```

This PDF was not created or modified during the handover task. Treat it as user-owned work:

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

### Documentation

- Development plan and architecture updated after every completed step.
- Dutch, PDF-ready user guide added with four SVG screen illustrations and extensive configuration
  examples.

Key commit: `b91a883`.

## 5. Current quality evidence

Last complete gate result:

- Backend: **64/64 tests passed**, Ruff/checks passed, Alembic drift check passed.
- Frontend: **38/38 tests across 10 files passed**, ESLint passed, TypeScript passed, Vite
  production build passed.
- Playwright E2E: **1/1 booking lifecycle test passed** against an isolated throwaway database.
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
| Models | `backend/app/models/` |
| API schemas | `backend/app/schemas/` |
| Entity validation/filtering | `backend/app/services/entity_service.py` |
| Booking roles/conflicts/querying | `backend/app/services/booking_service.py` |
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
| Booking form/details | `frontend/src/components/booking/BookingForm.tsx`, `BookingDetails.tsx` |
| BookingType API client | `frontend/src/api/bookingTypes.ts` |
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

## 9. Next increment: step 9

### Goal

Make calendar rescheduling fast without allowing inconsistent data.

### Required behavior

1. Persist FullCalendar event drops and duration changes through the Booking API while checking
   every exclusive participant.
2. Use optimistic feedback only when it can be rolled back reliably.
3. Restore the original calendar event after a rejected change.
4. Display a clear conflict message with the blocked interval, Entity, and role.
5. Prevent duplicate submissions during a pending update.
6. Keep fixed-duration BookingTypes consistent when an event is resized (the backend stays
   authoritative; expect resize rejection or auto-adjustment for fixed-duration types).

### Automated tests required by the plan

- successful move and resize operations;
- conflict rejection and visual rollback;
- network failure, repeated drops, and stale booking updates;
- Playwright coverage for successful and conflicting drag-and-drop flows.

### Definition of done

- Drag-and-drop persistence works end to end with conflict recovery.
- Backend and frontend full gates pass.
- Booking API scenario acceptance passes.
- Playwright drag-and-drop coverage passes against an isolated test database.
- `docs/development-plan.md`, `docs/architecture.md`, LifeOS project note, and this handover are
  updated; implementation and documentation are committed separately and pushed to `origin/main`.

## 10. Known limitations and cautions

- Drag-and-drop/resizing is intentionally not persisted yet; that is step 9.
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
Open HANDOVER.md and docs/development-plan.md. Continue Planboard with step 8 only: build the
complete calendar Booking create/detail/edit/cancel workflow, including visible-range loading,
role-derived participant fields, timezone-safe payloads, frontend tests, isolated Playwright E2E,
full quality gates, documentation, separate commits, and push. Preserve the untracked
docs/gebruikershandleiding.pdf and do not start drag-and-drop from step 9.
```

