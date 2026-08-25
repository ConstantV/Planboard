import type { Booking } from "../../types/api";
import { formatDateTime } from "../../utils/datetime";

const statusLabels: Record<Booking["status"], string> = {
  confirmed: "Bevestigd",
  tentative: "Voorlopig",
  cancelled: "Geannuleerd",
};

export function BookingDetails({
  booking,
  saving,
  onEdit,
  onCancelBooking,
  onClose,
}: {
  booking: Booking;
  saving: boolean;
  onEdit: () => void;
  onCancelBooking: () => void;
  onClose: () => void;
}) {
  const cancelled = booking.status === "cancelled";

  return (
    <section className="panel editor-panel" aria-label="Bookingdetails">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Booking</p>
          <h2>{booking.booking_type?.name ?? "Afspraak"}</h2>
          <p>
            {formatDateTime(booking.start_at)} – {formatDateTime(booking.end_at)}
          </p>
        </div>
        <span className={`chip${cancelled ? "" : " chip--accent"}`}>
          {statusLabels[booking.status]}
        </span>
      </div>

      <dl className="detail-list">
        <div>
          <dt>Deelnemers</dt>
          <dd>
            <ul className="participant-list">
              {booking.participants.map((participant) => (
                <li key={participant.id}>
                  <span
                    className="color-dot"
                    style={{ backgroundColor: participant.resolved_color }}
                    aria-hidden="true"
                  />
                  <strong>{participant.entity_name}</strong>
                  <small>
                    {participant.role_label}
                    {participant.is_exclusive ? " · blokkeert tijd" : ""}
                  </small>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        {booking.booking_type && (
          <div>
            <dt>Afspraaktype</dt>
            <dd>
              {booking.booking_type.name}
              {booking.booking_type.default_duration_minutes
                ? ` · ${booking.booking_type.default_duration_minutes} minuten (${
                    booking.booking_type.duration_mode === "fixed" ? "vast" : "voorgesteld"
                  })`
                : ""}
            </dd>
          </div>
        )}
        {booking.notes && (
          <div>
            <dt>Notities</dt>
            <dd>{booking.notes}</dd>
          </div>
        )}
      </dl>

      <div className="form-actions">
        <button
          className="button button--primary"
          type="button"
          disabled={saving || cancelled}
          onClick={onEdit}
        >
          Bewerken
        </button>
        <button
          className="button button--danger"
          type="button"
          disabled={saving || cancelled}
          onClick={onCancelBooking}
        >
          Annuleer booking
        </button>
        <button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>
          Sluiten
        </button>
      </div>
    </section>
  );
}
