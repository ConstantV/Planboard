from fastapi import APIRouter

from app.api.routes import (
    availability,
    booking_types,
    bookings,
    business_hours,
    categories,
    configuration,
    entities,
    health,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(configuration.router, tags=["configuration"])
api_router.include_router(business_hours.router, tags=["business-hours"])
api_router.include_router(booking_types.router, tags=["booking-types"])
api_router.include_router(categories.router, tags=["categories"])
api_router.include_router(entities.router, tags=["entities"])
api_router.include_router(bookings.router, tags=["bookings"])
api_router.include_router(availability.router, tags=["availability"])
