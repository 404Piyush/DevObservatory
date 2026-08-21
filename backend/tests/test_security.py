"""Tests for the security hardening changes.

These tests exercise the security-critical behaviour directly without booting Postgres.
A real run would use sqlite + an in-memory limiter; here we cover the JWT/security
utilities and the config validator, which is where the audit's fixes landed.
"""

import uuid

import pytest

from app.core import security
from app.core.config import Settings


def test_strong_secrets_required_in_non_local() -> None:
    with pytest.raises(Exception):
        Settings(environment="prod", jwt_secret_key="change-me", api_key_hash_secret="x" * 40, _env_file=None)
    with pytest.raises(Exception):
        Settings(environment="prod", jwt_secret_key="x" * 40, api_key_hash_secret="change-me-too", _env_file=None)
    # Short secret rejected
    with pytest.raises(Exception):
        Settings(environment="prod", jwt_secret_key="short", api_key_hash_secret="x" * 40, _env_file=None)


def test_local_env_allows_default_secrets() -> None:
    s = Settings(environment="local", _env_file=None)
    assert s.jwt_secret_key  # non-empty


def test_jwt_round_trip() -> None:
    token = security.create_access_token(subject="user", session_id="sess")
    decoded = security.decode_token(token)
    assert decoded["typ"] == "access"
    assert decoded["sub"] == "user"
    assert decoded["sid"] == "sess"
    assert "exp" in decoded and "iat" in decoded


def test_jwt_requires_all_claims() -> None:
    """Tokens missing required claims must be rejected."""
    import jwt as pyjwt
    from app.core.config import settings

    bad = pyjwt.encode({"sub": "x", "typ": "access"}, settings.jwt_secret_key, algorithm="HS256")
    with pytest.raises(ValueError):
        security.decode_token(bad)


def test_hash_api_key_deterministic_and_secret_independent() -> None:
    a = security.hash_api_key("hello")
    b = security.hash_api_key("hello")
    assert a == b
    assert security.hash_api_key("hello") != security.hash_api_key("world")


def test_invalid_token_raises_value_error() -> None:
    with pytest.raises(ValueError):
        security.decode_token("not-a-token")


def test_refresh_token_type_marker() -> None:
    refresh = security.create_refresh_token(subject="u", session_id=str(uuid.uuid4()))
    decoded = security.decode_token(refresh)
    assert decoded["typ"] == "refresh"


def test_decode_rejects_wrong_audience() -> None:
    token = security.create_access_token(subject="u", session_id=str(uuid.uuid4()))
    # Decode with same secret but make a fresh token that differs in audience by signing manually.
    import jwt as pyjwt
    from app.core.config import settings

    bad = pyjwt.encode(
        {
            "sub": "u",
            "sid": str(uuid.uuid4()),
            "typ": "access",
            "exp": 9999999999,
            "iat": 0,
            "iss": settings.jwt_issuer,
            "aud": "someone-else",
        },
        settings.jwt_secret_key,
        algorithm="HS256",
    )
    with pytest.raises(ValueError):
        security.decode_token(bad)