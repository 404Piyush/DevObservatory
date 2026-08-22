"""Tests for outbound webhook signature and filtering.

The dispatch loop hits the network, so we test the two pieces that don't:
HMAC signing and event_filter matching.
"""

import hashlib
import hmac
import json

from app.webhooks import SIGNATURE_HEADER, _matches, _sign


def test_sign_format_and_correctness() -> None:
    body = b'{"hello":"world"}'
    sig = _sign("topsecret", body)
    assert sig.startswith("sha256=")
    expected = "sha256=" + hmac.new(b"topsecret", body, hashlib.sha256).hexdigest()
    assert sig == expected


def test_sign_changes_with_secret() -> None:
    body = b"payload"
    a = _sign("secret-a", body)
    b = _sign("secret-b", body)
    assert a != b


def test_matches_active_unfiltered() -> None:
    class W:
        active = True
        event_filter = None
    assert _matches(W(), "anything") is True


def test_matches_active_filtered() -> None:
    class W:
        active = True
        event_filter = "user_signup"
    assert _matches(W(), "user_signup") is True
    assert _matches(W(), "page_view") is False


def test_matches_inactive_skipped() -> None:
    class W:
        active = False
        event_filter = None
    assert _matches(W(), "anything") is False


def test_signature_header_constant() -> None:
    assert SIGNATURE_HEADER == "X-DevObservatory-Signature"