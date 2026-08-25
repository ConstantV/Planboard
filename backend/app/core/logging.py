from __future__ import annotations

import json
import logging
import os
import sys
from logging import Formatter, StreamHandler
from typing import Any


class JsonFormatter(Formatter):
    """Emit log records as newline-delimited JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in payload:
                continue
            if key in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "message",
                "asctime",
            }:
                continue
            payload[key] = value
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging() -> None:
    """Configure root logging for the application.

    Uses a readable formatter in development and JSON in production. The
    ``PLANBOARD_LOG_JSON`` environment variable forces JSON output.
    """
    log_json = os.environ.get("PLANBOARD_LOG_JSON", "false").lower() in {"1", "true", "yes"}
    log_level = os.environ.get("PLANBOARD_LOG_LEVEL", "INFO").upper()

    handler = StreamHandler(sys.stdout)
    if log_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s"))

    root = logging.getLogger()
    root.setLevel(log_level)
    root.handlers = [handler]
