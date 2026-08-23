from fastapi import APIRouter

from app.api.routes import categories, configuration, entities, health

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(configuration.router, tags=["configuration"])
api_router.include_router(categories.router, tags=["categories"])
api_router.include_router(entities.router, tags=["entities"])
