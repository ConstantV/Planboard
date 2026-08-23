# Architecture

## Guiding principle

Planboard keeps scheduling rules and the data model in the Python backend. The React frontend is a
client of that API. SQLite supports local installations; PostgreSQL can replace it for a future
multi-tenant deployment without changing the domain contract.

## Configurable planning domain

- `EntityType` defines a kind of person or object, its default color, custom fields, and roles.
- `Entity` is one concrete customer, employee, station, rental Item, vehicle, workpiece, or other
  planning subject.
- `FieldDefinition` defines a typed, searchable, or filterable custom property.
- `EntityFieldValue` stores one validated typed value in a relational column.
- `EntityCategory` provides an optional hierarchy and category-level color.
- `RoleDefinition` defines how an EntityType participates in a Booking and whether it is exclusive.
- `BookingParticipant` connects any number of Entities to one Booking through configured roles.
- `Booking` owns the timezone-safe interval, status, and notes.

This structure supports salon, rental, and repair-workshop presets without industry-specific tables
or code paths.

## Management API

The `/api` management surface provides lifecycle endpoints for EntityTypes, FieldDefinitions,
RoleDefinitions, presets, categories, and Entities. Records with historical relevance are
deactivated instead of deleted. Responses use one structured error envelope with a stable code,
message, and optional details.

Entity queries can combine EntityType, category (including descendants), active state, free-text
search, and configured filterable fields. The same filtering service is intended to feed both the
calendar and list views in later frontend steps. The current MVP is single-user; authentication and
authorization are explicitly deferred rather than implied by these administrator endpoints.

## Custom-field storage decision

Arbitrary JSON was rejected as the primary value store because Planboard must filter on configured
properties reliably. Definitions are relational and values use datatype-specific indexed columns:
text/select, number, boolean, and date. JSON is limited to select-option configuration.

This Entity-Attribute-Value shape costs an extra join but provides centralized validation,
field-level lifecycle rules, and equivalent query semantics in SQLite and PostgreSQL. Performance is
guarded through indexes and representative filter tests; a future PostgreSQL deployment may add
specialized indexes without changing the API.

## Scheduling conflicts

An interval is half-open: its start is inclusive and its end is exclusive. Two intervals overlap
when one starts before the other ends and ends after the other starts. Cancelled Bookings do not
block time. Overlap protection applies to every BookingParticipant whose RoleDefinition is marked
`is_exclusive`; customer or workpiece roles can therefore be non-exclusive while staff, rental
Items, and stations block time.

## Color resolution

Calendar color is resolved deterministically in this order:

1. Entity color.
2. EntityCategory color.
3. EntityType color.
4. Application default `#3788D8`.

The UI must also expose labels or patterns so color is never the only source of meaning.

## Migration compatibility

Migration `20260823_0002` preserves step-2 data. Clients and Items become Entities, client contact
fields and `item_type` become typed values, Item categories become Entity categories, and every old
Booking receives customer and resource participants. Downgrade is supported while all Bookings can
still be represented by those two legacy roles; it stops explicitly rather than discarding custom
Booking structures.

## Security boundary

Passport, driver's-licence, or comparable identity data is not part of a default preset. Adding such
a FieldDefinition requires a separate decision covering access control, encryption, retention,
backup, export, and deletion. The current single-user MVP has no authorization model suitable for
that data.

## Deferred features

Recurring Bookings, notifications, payments, tenant configuration, route/Gantt views, and document
generation remain outside this architecture step. Markdown-to-PDF contracts are retained as a pilot
option after template safety and privacy requirements are known.
