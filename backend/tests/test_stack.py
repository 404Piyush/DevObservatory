"""Tests for the stack-trace frame parser."""

import pytest

from app.stack import parse_stack


def test_parses_sentry_style_object_frames() -> None:
    frames = parse_stack(
        [
            {
                "function": "handleRequest",
                "filename": "/app/server.ts",
                "lineno": 42,
                "colno": 7,
                "in_app": True,
            },
            {
                "function": "run",
                "filename": "/app/runner.ts",
                "lineno": 12,
                "colno": 3,
                "in_app": False,
            },
        ]
    )
    assert frames is not None
    assert len(frames) == 2
    assert frames[0]["function"] == "handleRequest"
    assert frames[0]["file"] == "/app/server.ts"
    assert frames[0]["line"] == 42
    assert frames[0]["col"] == 7
    assert frames[0]["in_app"] is True
    assert frames[1]["in_app"] is False


def test_parses_python_traceback_strings() -> None:
    frames = parse_stack(
        [
            'File "/app/main.py", line 10, in <module>',
            'File "/app/util.py", line 5, in helper',
        ]
    )
    assert frames is not None
    assert len(frames) == 2
    assert frames[0]["function"] == "<module>"
    assert frames[0]["file"] == "/app/main.py"
    assert frames[0]["line"] == 10


def test_parses_js_at_with_parens() -> None:
    frames = parse_stack(
        [
            "at handleRequest (server.ts:42:7)",
            "at Object.<anonymous> (index.js:1:1)",
        ]
    )
    assert frames is not None
    assert frames[0]["function"] == "handleRequest"
    assert frames[0]["file"] == "server.ts"
    assert frames[0]["line"] == 42
    assert frames[0]["col"] == 7


def test_parses_js_at_bare() -> None:
    frames = parse_stack(["at server.ts:42:7"])
    assert frames is not None
    assert frames[0]["function"] is None
    assert frames[0]["file"] == "server.ts"
    assert frames[0]["line"] == 42
    assert frames[0]["col"] == 7


def test_returns_none_for_non_list() -> None:
    assert parse_stack("not a list") is None
    assert parse_stack({"frames": []}) is None


def test_returns_none_for_empty_list() -> None:
    assert parse_stack([]) is None


def test_skips_garbage_frames_but_returns_rest() -> None:
    frames = parse_stack(
        [
            "garbage line that doesn't match",
            {"function": "valid", "filename": "x.py", "lineno": 1},
        ]
    )
    assert frames is not None
    assert len(frames) == 1
    assert frames[0]["function"] == "valid"


def test_coerces_string_line_numbers() -> None:
    frames = parse_stack([{"filename": "x.py", "lineno": "42"}])
    assert frames[0]["line"] == 42


def test_handles_missing_optional_fields() -> None:
    frames = parse_stack([{"filename": "x.py"}])
    assert frames[0]["function"] is None
    assert frames[0]["line"] is None
    assert frames[0]["col"] is None
    assert frames[0]["in_app"] is None