from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import DbSession
from app.api.errors import ApiError
from app.models import EntityCategory
from app.schemas.entity import EntityCategoryCreate, EntityCategoryRead, EntityCategoryUpdate
from app.services.management_service import serialize_category

router = APIRouter()


def load_category(session: Session, category_id: str) -> EntityCategory:
    category = session.scalar(
        select(EntityCategory)
        .where(EntityCategory.id == category_id)
        .options(selectinload(EntityCategory.parent))
    )
    if category is None:
        raise ApiError(404, "category_not_found", "EntityCategory does not exist")
    return category


def resolve_parent(session: Session, parent_id: str | None) -> EntityCategory | None:
    if parent_id is None:
        return None
    parent = load_category(session, parent_id)
    if not parent.is_active:
        raise ApiError(422, "inactive_parent", "Parent category is inactive")
    return parent


@router.get("/categories", response_model=list[EntityCategoryRead])
def list_categories(
    session: DbSession,
    include_inactive: bool = False,
) -> list[dict]:
    statement = select(EntityCategory).options(selectinload(EntityCategory.parent))
    if not include_inactive:
        statement = statement.where(EntityCategory.is_active.is_(True))
    categories = list(session.scalars(statement.order_by(EntityCategory.name)))
    return [serialize_category(category) for category in categories]


@router.post(
    "/categories",
    response_model=EntityCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    payload: EntityCategoryCreate,
    session: DbSession,
) -> dict:
    category = EntityCategory(
        name=payload.name,
        parent=resolve_parent(session, payload.parent_id),
        color=payload.color,
    )
    session.add(category)
    session.commit()
    return serialize_category(category)


@router.get("/categories/{category_id}", response_model=EntityCategoryRead)
def get_category(category_id: str, session: DbSession) -> dict:
    return serialize_category(load_category(session, category_id))


@router.patch("/categories/{category_id}", response_model=EntityCategoryRead)
def update_category(
    category_id: str,
    payload: EntityCategoryUpdate,
    session: DbSession,
) -> dict:
    category = load_category(session, category_id)
    changes = payload.model_dump(exclude_unset=True)
    try:
        if "parent_id" in changes:
            category.parent = resolve_parent(session, changes.pop("parent_id"))
        for key, value in changes.items():
            setattr(category, key, value)
        session.commit()
    except ValueError as error:
        session.rollback()
        raise ApiError(422, "invalid_category", str(error)) from error
    return serialize_category(category)


@router.post("/categories/{category_id}/deactivate", response_model=EntityCategoryRead)
def deactivate_category(category_id: str, session: DbSession) -> dict:
    category = load_category(session, category_id)
    category.is_active = False
    session.commit()
    return serialize_category(category)
