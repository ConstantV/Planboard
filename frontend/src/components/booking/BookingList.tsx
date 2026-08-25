import type { Booking } from "../../types/api";

interface BookingListProps {
  bookings: Booking[];
  onSelect: (booking: Booking) => void;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusLabel: Record<string, string> = {
  confirmed: "Bevestigd",
  tentative: "Voorlopig",
  cancelled: "Geannuleerd",
};

export function BookingList({ bookings, onSelect }: BookingListProps) {
  if (bookings.length === 0) {
    return (
      <div className="panel booking-list-panel">
        <p className="muted-copy">Geen bookings gevonden voor de huidige filters.</p>
      </div>
    );
  }

  return (
    <div className="panel booking-list-panel" role="region" aria-label="Bookinglijst">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Tijd</th>
            <th>Status</th>
            <th>Type</th>
            <th>Deelnemers</th>
            <th>Notities</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr
              key={booking.id}
              className={`booking-table__row booking-table__row--${booking.status}`}
              onClick={() => onSelect(booking)}
              tabIndex={0}
              role="button"
              aria-label={`${statusLabel[booking.status] ?? booking.status} booking van ${formatDateTime(booking.start_at)} tot ${new Date(booking.end_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(booking);
                }
              }}
            >
              <td>
                {formatDateTime(booking.start_at)} –{" "}
                {new Date(booking.end_at).toLocaleTimeString("nl-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td>
                <span className={`chip chip--${booking.status}`}>
                  {statusLabel[booking.status] ?? booking.status}
                </span>
              </td>
              <td>{booking.booking_type?.name ?? "–"}</td>
              <td>
                <div className="booking-table__participants">
                  {booking.participants.map((participant) => (
                    <span
                      key={participant.id}
                      className="booking-table__participant"
                      title={`${participant.entity_name} (${participant.role_label})`}
                    >
                      <span
                        className="color-dot"
                        style={{ backgroundColor: participant.resolved_color }}
                        aria-hidden="true"
                      />
                      <span>{participant.entity_name}</span>
                    </span>
                  ))}
                </div>
              </td>
              <td className="booking-table__notes">{booking.notes ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
