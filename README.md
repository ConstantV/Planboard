# Planboard

Planboard is a flexible scheduling application that connects configurable people, objects, and resources to a date, time, and duration. Its generic planning core targets appointment services, rental, and workshop-routing use cases.

## Repository layout

```text
Planboard/
├── backend/                 FastAPI application and tests
│   ├── app/
│   │   ├── api/routes/     HTTP endpoints
│   │   ├── core/           Configuration
│   │   ├── db/             Database setup
│   │   ├── models/         SQLAlchemy models
│   │   ├── schemas/        API contracts
│   │   └── services/       Business rules
│   └── tests/
├── frontend/                React and TypeScript application
│   └── src/
│       ├── api/             Backend client
│       ├── components/      Reusable UI components
│       └── types/           Shared frontend types
└── docs/                    Reserved for technical documentation
```

## Requirements

- Python 3.12+
- `uv` for Python dependency management
- Bun for frontend dependency management

## Start the backend

```bash
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

The API will be available at <http://localhost:8000>. The health endpoint is `GET /api/health`.
Interactive API documentation is available at <http://localhost:8000/docs>.

Step 4 exposes management APIs for EntityTypes and their custom fields, planning roles and
presets, hierarchical categories, and Entities. Entity listing supports free-text search plus
combinable type, category-descendant, active-state, and typed custom-field filters.

## Start the frontend

```bash
cd frontend
cp .env.example .env
bun install
bun run dev
```

The Vite development server will be available at <http://localhost:5173>.

## Quality checks

Run the complete backend quality gate:

```bash
cd backend
./scripts/check.sh
```

Run the complete frontend quality gate:

```bash
cd frontend
bun run check
```

Run the isolated salon, rental, and repair-workshop Booking API acceptance:

```bash
cd backend
uv run python -m scripts.verify_booking_api
```

## Current scope

- FastAPI application with a health endpoint
- Alembic-managed SQLite database schema
- Configurable `EntityType`, `Entity`, `FieldDefinition`, category, and role models
- Management API with structured validation errors, search, filtering, and archive/deactivation
- Multi-entity Booking API with scoped required roles and atomic overlap protection
- Shared Booking filters for interval, EntityType, Entity, role, category descendants, status,
  configured fields, and free text
- Multi-participant Bookings with overlap checks for exclusive planning roles
- React shell with an editable FullCalendar week view
- Routed React shell for planning, Entities, and configuration
- Server-backed FullCalendar data with no hard-coded demo events
- Typed frontend clients for configuration, Entity, category, and Booking APIs
- Shared loading, empty, offline, validation, conflict, and server-error states with retry
- Recovering backend connectivity status in the UI

## Product direction

The current architecture generalizes the transitional `Item` and `Client` models into configurable planning entities. A Booking can contain multiple role-based participants, such as customer + hairdresser + chair, customer + rental Item, or workpiece + mechanic + workbench. Entity types define custom validated fields, searchable/filterable behaviour, scheduling exclusivity, and optional calendar colors.

See [`wensen.md`](wensen.md) for the original scenarios and [`docs/development-plan.md`](docs/development-plan.md) for their phased implementation.

The source project plan lives in `MyVault/01. Projects/Planboard/Planboard.md`.

## Delivery plan

Development is divided into individually implemented and verified increments. See [`docs/development-plan.md`](docs/development-plan.md) for step scope, tests, acceptance criteria, and progress evidence.
