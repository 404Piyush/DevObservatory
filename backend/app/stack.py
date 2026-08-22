"""Stack-trace frame parser.

Accepts the values commonly seen under `properties.stack` in event payloads:
  * Sentry-style: a list of dicts with function/filename/lineno/colno/in_app
  * Python-style: a list of strings like 'File "x.py", line 5, in foo'
  * JS-style: a list of strings like 'at foo (x.js:5:3)'

Returns a normalized list of frames:
    {"function": str | None, "file": str | None, "line": int | None,
     "col": int | None, "in_app": bool | None, "raw": Any}
"""
from __future__ import annotations

import re
from typing import Any


# Python traceback line: 'File "x.py", line 5, in foo'
_PY_LINE = re.compile(
    r'^File\s+"(?P<file>[^"]+)",\s+line\s+(?P<line>\d+)(?:,\s+in\s+(?P<func>.+))?',
)

# JS-style: 'at func (file:line:col)' or 'at func (file:line)' or 'at file:line:col'
_JS_AT_PARENS = re.compile(
    r"^at\s+(?P<func>.+?)\s+\((?P<file>[^):]+):(?P<line>\d+)(?::(?P<col>\d+))?\)"
)
_JS_AT_BARE = re.compile(r"^at\s+(?P<file>[^:]+):(?P<line>\d+)(?::(?P<col>\d+))?")


def parse_stack(value: Any) -> list[dict[str, Any]] | None:
    """Return a normalized list of frames, or None if value isn't a stack."""
    if not isinstance(value, list) or not value:
        return None
    frames: list[dict[str, Any]] = []
    for item in value:
        frame = _parse_one(item)
        if frame is not None:
            frames.append(frame)
    return frames if frames else None


def _parse_one(item: Any) -> dict[str, Any] | None:
    if isinstance(item, dict):
        # Sentry-style object frame
        return {
            "function": item.get("function") or item.get("method"),
            "file": item.get("filename") or item.get("file") or item.get("abs_path"),
            "line": _coerce_int(item.get("lineno") or item.get("line")),
            "col": _coerce_int(item.get("colno") or item.get("col")),
            "in_app": item.get("in_app"),
            "raw": item,
        }
    if isinstance(item, str):
        line = item.strip()
        # Python
        m = _PY_LINE.match(line)
        if m:
            return {
                "function": m.group("func"),
                "file": m.group("file"),
                "line": int(m.group("line")),
                "col": None,
                "in_app": None,
                "raw": item,
            }
        # JS with parens
        m = _JS_AT_PARENS.match(line)
        if m:
            return {
                "function": m.group("func"),
                "file": m.group("file"),
                "line": int(m.group("line")),
                "col": _coerce_int(m.group("col")),
                "in_app": None,
                "raw": item,
            }
        # JS bare
        m = _JS_AT_BARE.match(line)
        if m:
            return {
                "function": None,
                "file": m.group("file"),
                "line": int(m.group("line")),
                "col": _coerce_int(m.group("col")),
                "in_app": None,
                "raw": item,
            }
    return None


def _coerce_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None