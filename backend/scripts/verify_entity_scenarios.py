from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal
from app.models import Booking, BookingParticipant, Entity
from app.services.entity_service import filter_entities, resolve_entity_color, set_entity_values
from app.services.presets import apply_preset

SAMPLE_VALUES = {
    "salon_customer": {"phone": "0612345678"},
    "rental_customer": {"phone": "0687654321"},
    "rental_item": {
        "description": "Elektrische bestelbus",
        "brand": "Ford",
        "model": "E-Transit",
        "registration": "V-123-AB",
    },
    "workpiece": {
        "serial_number": "VALVE-001",
        "work_description": "Klep reviseren",
        "work_status": "received",
    },
}


def main() -> None:
    session = SessionLocal()
    try:
        scenario_results = []
        start_at = datetime(2026, 8, 26, 8, tzinfo=UTC)
        for scenario_index, preset_key in enumerate(("hair_salon", "rental", "repair_workshop")):
            entity_types = apply_preset(session, preset_key)
            booking = Booking(
                start_at=start_at + timedelta(hours=scenario_index * 2),
                end_at=start_at + timedelta(hours=scenario_index * 2 + 1),
            )
            for display_order, entity_type in enumerate(entity_types):
                entity = Entity(
                    name=f"{entity_type.name} voorbeeld",
                    entity_type=entity_type,
                )
                set_entity_values(session, entity, SAMPLE_VALUES.get(entity_type.key, {}))
                role = entity_type.role_definitions[0]
                booking.participants.append(
                    BookingParticipant(
                        entity=entity,
                        role_definition=role,
                        display_order=display_order,
                    )
                )
            session.add(booking)
            session.flush()
            scenario_results.append(
                {
                    "scenario": preset_key,
                    "roles": [
                        participant.role_definition.key for participant in booking.participants
                    ],
                    "exclusive": [
                        participant.role_definition.key
                        for participant in booking.participants
                        if participant.role_definition.is_exclusive
                    ],
                    "colors": [
                        resolve_entity_color(participant.entity)
                        for participant in booking.participants
                    ],
                }
            )

        rental_matches = filter_entities(session, "rental_item", {"brand": "Ford"})
        workshop_matches = filter_entities(
            session,
            "workpiece",
            {"work_status": "received"},
        )
        print(
            {
                "scenarios": scenario_results,
                "rental_filter": [entity.name for entity in rental_matches],
                "workshop_filter": [entity.name for entity in workshop_matches],
            }
        )
    finally:
        session.rollback()
        session.close()


if __name__ == "__main__":
    main()
