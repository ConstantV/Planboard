# Domain model decisions

## Entity types and entities

An EntityType is administrator-configurable and represents a kind such as customer, employee,
station, rental Item, vehicle, workpiece, or workbench. An Entity is one concrete person or object.
Stable core fields—ID, name, type, active state, optional category, and optional color—remain normal
columns.

The former Item and Client models were transitional. Migration `20260823_0002` consolidates their
records into Entities without discarding contact data, Item type, category, active/archive state, or
Booking relationships.

## Categories

An Entity may belong to one active or inactive EntityCategory. Categories form an optional
self-referencing hierarchy through `parent_id`. Root categories have no parent. Moving a category
below itself or one of its descendants is rejected.

Categories are normally deactivated instead of deleted. A category with children cannot be deleted.
Deleting a leaf category leaves linked Entities available and uncategorized through `SET NULL`.
Indexes on `parent_id` and `Entity.category_id` support hierarchy and category filtering.

## Configurable fields

A FieldDefinition belongs to one EntityType and supports `text`, `number`, `boolean`, `date`, or
`select`. It records required, searchable, filterable, display-order, and lifecycle settings. Select
options are validated and stored as JSON configuration; actual values are stored in indexed typed
columns on EntityFieldValue.

Unknown fields, missing required values, type mismatches, invalid select options, and datatype
changes with existing values are rejected. Sensitive identity-document fields are not enabled by
default.

## Roles and Bookings

A Booking contains one or more BookingParticipants. Each participant connects an Entity through a
RoleDefinition such as customer, staff, resource, station, or subject. Roles define requiredness,
multiplicity, ordering, and whether the Entity is exclusive for overlap checks.

Booking status is restricted to `confirmed`, `tentative`, or `cancelled`. Every interval must satisfy
`end_at > start_at`; both lifecycle validation and a database check enforce it. The half-open interval
allows adjacent Bookings.

Entities, EntityTypes, FieldDefinitions, and RoleDefinitions referenced by historical data use
restrictive foreign keys and should normally be deactivated rather than deleted.

## Timezones

The API accepts only timezone-aware Booking timestamps. They are converted to UTC before storage.
SQLite stores the normalized value without an offset, and the custom SQLAlchemy type restores UTC
when loading it. Display in a local business timezone is a frontend responsibility.

## Colors

Colors use `#RRGGBB` and normalize to uppercase. Resolution order is Entity, EntityCategory,
EntityType, then `#3788D8`.

## Presets

Seedable hair-salon, rental, and repair-workshop presets prove that configuration describes the
requested roles and fields without changing the domain model. They are examples, not hard-coded
business branches.

## Schema lifecycle

Alembic exclusively owns schema creation and upgrades. Run `uv run alembic upgrade head` before
starting the API. The application never calls SQLAlchemy `create_all` during startup.
