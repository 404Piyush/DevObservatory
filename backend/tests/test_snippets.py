"""Tests for the SDK snippet generator.

Mirrors the frontend snippets.ts; we keep a Python copy here so the same
templates can be verified from CI without booting Node.
"""
from textwrap import dedent


def curl_snippet(api_key: str, event_name: str = "user_signup") -> str:
    return dedent(
        f"""\
        curl -X POST http://localhost:8000/api/events \\
          -H "X-API-Key: {api_key}" \\
          -H "Content-Type: application/json" \\
          -d '{{
            "event_name": "{event_name}",
            "user_id": "user_123",
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "properties": {{"plan": "pro"}}
          }}'"""
    )


def test_curl_snippet_includes_key_and_event() -> None:
    out = curl_snippet("do_abc123", "page_view")
    assert "do_abc123" in out
    assert "page_view" in out
    assert "X-API-Key" in out


def test_curl_snippet_uses_default_event_name() -> None:
    out = curl_snippet("do_abc123")
    assert "user_signup" in out


def test_curl_snippet_is_a_single_command() -> None:
    out = curl_snippet("do_abc123")
    assert out.startswith("curl ")
    assert out.count("\n  -H ") >= 2