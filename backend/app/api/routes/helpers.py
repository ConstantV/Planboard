import json
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.errors import ApiError


def commit_or_conflict(session: Session, message: str) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise ApiError(409, "conflict", message) from error


def parse_field_filters(filters: str | None) -> dict[str, Any]:
    if filters is None or not filters.strip():
        return {}
    try:
        parsed = json.loads(filters)
    except json.JSONDecodeError as error:
        raise ApiError(422, "invalid_filters", "filters must be a JSON object") from error
    if not isinstance(parsed, dict):
        raise ApiError(422, "invalid_filters", "filters must be a JSON object")
    return parsed
