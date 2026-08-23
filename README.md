# Planboard

Planboard is a flexible scheduling application that connects an item, client, and duration. The MVP targets appointment-based services while keeping the scheduling core generic enough for rental and workshop-routing use cases.

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

## Current scope

- FastAPI application with a health endpoint
- Alembic-managed SQLite database schema
- Validated `ItemCategory`, `Item`, `Client`, and `Booking` models
- Booking-overlap query as the first scheduling business rule
- React shell with an editable FullCalendar week view
- Backend connectivity status in the UI

The source project plan lives in `MyVault/01. Projects/Planboard/Planboard.md`.

## Delivery plan

Development is divided into individually implemented and verified increments. See [`docs/development-plan.md`](docs/development-plan.md) for step scope, tests, acceptance criteria, and progress evidence.
