# Domain model decisions

## Categories

An Item may belong to one active or inactive Item category. Categories form an optional
self-referencing hierarchy through `parent_id`. Root categories have no parent. Moving a category
below itself or one of its descendants is rejected by the model lifecycle validation.

Categories are normally deactivated instead of deleted. A category with children cannot be deleted
because its parent foreign key uses `RESTRICT`. If a leaf category is deliberately deleted, linked
Items remain available and become uncategorized through `SET NULL`. Indexes on `parent_id` and
`Item.category_id` support hierarchy traversal and category filtering.

## Bookings

Booking status is restricted to `confirmed`, `tentative`, or `cancelled`. An interval is half-open:
`start_at` is inclusive and `end_at` is exclusive, so adjacent bookings do not overlap. Every interval
must have `end_at > start_at`; both SQLAlchemy lifecycle validation and a database check constraint
enforce this rule.

Items and Clients referenced by a Booking cannot be deleted at the database layer. Later API phases
therefore deactivate or archive these records while preserving booking history.

## Timezones

The API accepts only timezone-aware booking timestamps. They are converted to UTC before storage.
SQLite stores the normalized value without an offset, and the custom SQLAlchemy type restores the UTC
timezone when loading it. API responses therefore always contain timezone-aware values. Display in a
local business timezone is a frontend responsibility.

## Schema lifecycle

Alembic owns schema creation and upgrades. Run `uv run alembic upgrade head` before starting the API.
The application no longer calls SQLAlchemy `create_all` during startup.
