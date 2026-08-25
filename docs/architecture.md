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
- `BookingType` defines a configurable appointment, treatment, rental, or activity kind within one
  `booking_scope`, carrying an optional positive default duration in minutes and a duration mode:
  `suggested` proposes an end time the user may adjust, `fixed` requires the interval to match the
  default duration exactly on create and on interval-changing updates. A BookingType in use cannot
  change key or scope, and deactivation is preferred over deletion.
- `Booking` owns the timezone-safe interval, status, notes, and an optional BookingType reference
  (`ON DELETE SET NULL`).
- `BusinessHours` configures open/closed times per day of week. When present, Bookings must fall
  entirely within open hours on every day they touch; the calendar visible range derives from the
  earliest open and latest close of the configured week.

This structure supports salon, rental, and repair-workshop presets without industry-specific tables
or code paths.

Required roles are grouped by `booking_scope`. All participants in one Booking must use roles from
the same scope, and every active required role in that scope must occur with its configured
cardinality. This prevents roles from unrelated presets or legacy data from becoming accidental
requirements for a Booking.

## Management API

The `/api` management surface provides lifecycle endpoints for EntityTypes, FieldDefinitions,
RoleDefinitions, BookingTypes, presets, categories, and Entities. Records with historical relevance
are deactivated instead of deleted. Responses use one structured error envelope with a stable code,
message, and optional details.

Entity queries can combine EntityType, category (including descendants), active state, free-text
search, and configured filterable fields. The same filtering service is intended to feed both the
calendar and list views in later frontend steps. The current MVP is single-user; authentication and
authorization are explicitly deferred rather than implied by these administrator endpoints.

## Frontend application shell

React Router owns page-level navigation between planning, Entities, and configuration. Pages never
call `fetch` directly: typed modules expose the management and Booking contracts through one client
that classifies offline, validation, conflict, and server errors. Shared resource hooks and status
components provide loading, empty, retry, and recovery behaviour consistently.

FullCalendar receives only mapped Booking API responses; the temporary demo event and non-persisted
editing behaviour have been removed. The Planning page loads Bookings for FullCalendar's visible
date range (`datesSet` → timezone-aware `range_start`/`range_end`), opens a prefilled create form
on slot selection, and exposes detail, edit, and cancel flows on event click. The booking form is
rendered in a modal; selecting another slot while the modal is open updates the form's start/end
without closing it. After a successful mutation only the visible range reloads; a dedicated query/cache
dependency remains deferred until shared filtering or multi-user concurrency justifies it.

A shared `FilterBar` drives the calendar, list, availability, and occupancy views with one central
filter state. Active filters are shown as removable chips with a clear-all action; the calendar and
list views render the same filtered result set. A `ColorLegend` panel exposes configured EntityType
colors as text labels so color is never the only source of meaning.

FullCalendar `eventDrop` and `eventResize` are wired to a narrow `PATCH /api/bookings/{id}/slot` endpoint that only
changes `start_at` and `end_at`. The backend reuses the existing participant, BookingType, and conflict validation.
The calendar event is not updated optimistically: the page waits for the response, reloads the visible range on
success, and calls FullCalendar's `revert()` on failure so the event snaps back to its original slot. A clear
conflict message lists every blocked Entity, role, and interval. Fixed-duration BookingTypes render their events with
`durationEditable: false` so the calendar refuses to resize them; the slot endpoint still enforces the exact duration
if the UI is bypassed.

Browser-level confidence comes from a Playwright suite (`frontend/e2e/`, `bun run test:e2e`) that
starts the API with a throwaway SQLite file and the frontend on dedicated ports. Alembic honours
`PLANBOARD_DATABASE_URL`, so migrations target that temporary database and never the development
database.

## Frontend management interface

The configuration and Entity pages form a browser-based administration layer over the management
API, including BookingType duration rules per booking scope. Reusable controlled forms own local
validation, while one mutation hook normalizes pending,
success, validation, conflict, offline, and server feedback. Successful mutations reload the small
affected management dataset; optimistic caching remains unnecessary for the single-user MVP.

Entity forms are generated at runtime from active FieldDefinitions and convert text, number,
boolean, date, and select controls into the typed API contract. Entity search combines fixed and
configured filters. Category management renders the materialized category paths as a tree and
prevents an edited node or any descendant from being selected as its parent; the backend remains
the authoritative cycle guard.

Page routes use lazy imports. This separates the FullCalendar bundle from configuration and Entity
management code and keeps the initial application shell smaller without introducing another state
or data-fetching dependency.

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

Create and update lock every involved Entity row before overlap detection on databases that support
row locking. SQLite starts Booking writes with `BEGIN IMMEDIATE`, serializing the check-and-write
sequence. Conflict responses identify every blocked Entity, requested role, conflicting role,
Booking, and interval. Cancelled Bookings never block time; adjacent half-open intervals are valid.

The Booking list endpoint is the shared result contract for the calendar and list views. It can
combine an overlapping time range, EntityType, Entity, role, category descendants, status,
configured filterable fields, and literal free-text search. SQL wildcard characters in user search
input are escaped. The same filter object drives `GET /api/bookings/export.csv`, which returns a
UTF-8 BOM-encoded CSV for Excel compatibility.

A separate `GET /api/availability` endpoint returns exclusive Entities that are free for a requested
interval, using the same half-open overlap semantics as Booking conflict protection and supporting
role, EntityType, category, configured field, and current-booking-exclusion filters.
`GET /api/entities/{id}/occupancy` returns one Entity's Bookings and free gaps within business hours
for a requested range, so users can inspect a single resource and find compatible free slots.

Backend logging is configured through `PLANBOARD_LOG_JSON` and `PLANBOARD_LOG_LEVEL`. Booking
mutations and conflicts are logged at `INFO`/`WARNING` to support operational debugging without
leaving sensitive data in unstructured text.

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
