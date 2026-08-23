# Architecture

## Guiding principle

Planboard keeps scheduling rules and the data model in the Python backend. The React frontend is a client of that API. SQLite supports local installations; PostgreSQL can replace it for a future multi-tenant deployment without changing the domain model.

## Initial domain

- `Item`: the resource being scheduled
- `Client`: the customer connected to a booking
- `Booking`: the interval that connects an item and client

An interval overlaps an existing booking when its start is before the existing end and its end is after the existing start. Cancelled bookings do not block a time slot.

## Boundaries

The first MVP does not include recurring bookings, notifications, payments, role-based access, routing, or tenant configuration. These features should not be introduced until the scheduling workflow is usable end to end.
