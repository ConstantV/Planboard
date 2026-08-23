import re

HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def validate_optional_color(color: str | None) -> str | None:
    if color is not None and HEX_COLOR_PATTERN.fullmatch(color) is None:
        raise ValueError("color must use #RRGGBB format")
    return color.upper() if color is not None else None
