import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, subject: str, session_id: str, now: datetime | None = None) -> str:
    issued_at = now or datetime.now(UTC)
    expire = issued_at + timedelta(seconds=settings.access_token_ttl_seconds)
    payload: dict[str, Any] = {
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "sub": subject,
        "sid": session_id,
        "iat": int(issued_at.timestamp()),
        "exp": int(expire.timestamp()),
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def create_refresh_token(*, subject: str, session_id: str, now: datetime | None = None) -> str:
    issued_at = now or datetime.now(UTC)
    expire = issued_at + timedelta(seconds=settings.refresh_token_ttl_seconds)
    payload: dict[str, Any] = {
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "sub": subject,
        "sid": session_id,
        "iat": int(issued_at.timestamp()),
        "exp": int(expire.timestamp()),
        "typ": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except JWTError as e:
        raise ValueError("Invalid token") from e


def new_api_key() -> str:
    raw = secrets.token_urlsafe(40)
    return f"do_{raw}"


def hash_api_key(api_key: str) -> str:
    digest = hmac.new(settings.jwt_secret_key.encode("utf-8"), api_key.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")

