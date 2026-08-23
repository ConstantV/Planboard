# Planboard handover

Last updated: 2026-08-23  
Repository: `https://github.com/ConstantV/Planboard.git`  
Branch: `main`  
Last pushed commit: `b91a883 docs: add configuration user guide`

## 1. Read this first

Planboard is complete through **development step 7**. The next implementation increment is
**step 8 — Calendar booking workflow**. Do not start step 9 drag-and-drop or step 10 shared
calendar/list filtering before step 8 passes its complete test and acceptance gate.

The authoritative documents are:

1. [`docs/development-plan.md`](docs/development-plan.md) — phased scope, acceptance criteria,
   evidence, and commit mapping.
2. [`docs/architecture.md`](docs/architecture.md) — domain and technical decisions.
3. [`wensen.md`](wensen.md) — original user scenarios and product wishes.
4. [`docs/gebruikershandleiding.md`](docs/gebruikershandleiding.md) — Dutch configuration and user
   guide with salon, rental, and workshop examples.
5. `MyVault/01. Projects/Planboard/Planboard.md` — LifeOS source project file outside this repo.

## 2. Important workspace state

At handover time, the tracked repository is synchronized with `origin/main` at `b91a883`.

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

### Documentation

- Development plan and architecture updated after every completed step.
- Dutch, PDF-ready user guide added with four SVG screen illustrations and extensive configuration
  examples.

Key commit: `b91a883`.

## 5. Current quality evidence

Last complete gate result:

- Backend: **57/57 tests passed**, Ruff/checks passed, Alembic drift check passed.
- Frontend: **25/25 tests across 8 files passed**, ESLint passed, TypeScript passed, Vite production
  build passed.
- Live HTTP acceptance passed for `/`, `/planning`, `/entities`, `/configuration`, management API
  endpoints, Booking API, health endpoint, and CORS preflight.

Run the gates again before the first step-8 change and before committing:

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
| Booking → event mapping | `frontend/src/mappers/booking.ts` |
| Entity management | `frontend/src/pages/EntitiesPage.tsx`, `components/management/EntityForm.tsx` |
| Configuration management | `frontend/src/pages/ConfigurationPage.tsx`, `components/management/` |
| Shared async/mutation states | `frontend/src/hooks/`, `components/PageState.tsx`, `MutationFeedback.tsx` |
| API types | `frontend/src/types/api.ts` |

## 8. Existing Booking frontend contract

The typed frontend client already exposes:

- `listBookings(filters)`
- `getBooking(id)`
- `createBooking(input)`
- `updateBooking(id, input)`
- `cancelBooking(id)`
- `deleteBooking(id)`

`bookingToEvent()` already maps:

- Booking ID;
- participant names into the title;
- start/end timestamps;
- resolved color from the first exclusive participant, falling back to the first participant;
- cancelled status into a CSS class;
- status, notes, and participants into `extendedProps`.

The current Planning page calls `listBookings()` without a visible range and only supports manual
refresh. `ScheduleCalendar` supplies month/week/day views and the interaction plugin, but no select,
event-click, create, edit, or cancellation callbacks are wired yet.

## 9. Next increment: step 8

### Goal

Create, inspect, edit, and cancel Bookings entirely from the calendar without using OpenAPI or
direct API calls.

### Required behavior

1. Query Bookings for FullCalendar's visible range using timezone-aware `range_start` and
   `range_end`.
2. Allow selecting a time slot to open a Booking create form.
3. Choose one booking scope, then render participant selectors from the active roles in that scope.
4. Enforce required roles and `allow_multiple` in the form before submission; backend remains
   authoritative.
5. Load eligible active Entities per role's EntityType.
6. Support start, end, status, notes, and role-bound participants.
7. Clicking an event opens detail with participant names/roles, interval, status, and notes.
8. Support edit and cancel with confirmation and structured conflict/validation/offline feedback.
9. Refresh only the affected calendar data after success. A visible-range reload is acceptable for
   the MVP; a new cache dependency is not required unless it clearly simplifies invalidation.
10. Keep cancelled events understandable and non-blocking.

### Suggested frontend decomposition

Keep components small and reuse step-7 form primitives:

```text
frontend/src/components/booking/
├── BookingDialog.tsx
├── BookingForm.tsx
├── BookingParticipantFields.tsx
└── BookingDetails.tsx
```

Likely state ownership:

- `PlanningPage`: visible range, selected slot/event, server loading/reload, mutation feedback.
- `ScheduleCalendar`: FullCalendar adapter and callback forwarding only.
- `BookingForm`: scope selection, role-derived participant fields, field validation, payload.
- `BookingDetails`: read-only summary plus edit/cancel actions.

Do not introduce drag-and-drop persistence in this increment; it belongs to step 9.

### Automated tests required by the plan

- visible-range requests from FullCalendar;
- Booking-to-event mapping for status, participants, roles, and resolved color;
- create, edit, cancel, loading, empty, conflict, validation, and offline states;
- participant form validation and exact submitted payload;
- timezone conversion at the API boundary;
- first Playwright end-to-end lifecycle: create → inspect → edit → cancel.

Playwright is not currently configured. Add it deliberately as part of step 8, keep its database
isolated, and document the command. Do not let an E2E test mutate the developer database.

### Manual acceptance

1. Create or reuse the necessary Entities for one preset.
2. Create a multi-participant Booking from a calendar slot.
3. Open and inspect it.
4. Edit its interval, notes, status, or participants.
5. Cancel it.
6. Confirm week and day views remain correct.
7. Confirm no direct API use was required.

### Definition of done

- The complete Booking lifecycle works end to end from the calendar.
- Backend and frontend full gates pass.
- Booking API scenario acceptance passes.
- Playwright lifecycle passes against an isolated test database.
- Manual week/day acceptance passes.
- `docs/development-plan.md`, `docs/architecture.md`, README/current scope, LifeOS project note, and
  this handover are updated.
- Implementation and documentation are committed separately and pushed to `origin/main`.

## 10. Known limitations and cautions

- Calendar Booking create/edit/detail/cancel UI is not built yet; that is step 8.
- Drag-and-drop/resizing is intentionally not persisted yet; that is step 9.
- Shared calendar/list filters and availability are intentionally step 10.
- Authentication/authorization and multi-tenancy are not part of the single-user MVP.
- Sensitive identity fields are intentionally absent pending explicit security, access, encryption,
  retention, export, and deletion decisions.
- Automated control of the in-app “Claude” browser tab was unavailable because the browser service
  rejected the connection. Step-7 UI is covered by DOM interaction tests and live HTTP checks, but
  a human visual/mobile smoke check remains useful.
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

