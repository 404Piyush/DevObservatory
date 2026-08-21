import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_api_key,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.deps import get_current_session, get_current_user
from app.limiter import limiter
from app.models import Session as DbSession
from app.models import User
from app.schemas import LoginRequest, RefreshRequest, TokenPair, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def register(request: Request, payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=payload.email, password_hash=hash_password(payload.password), name=payload.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    now = datetime.now(UTC)
    session = DbSession(
        user_id=user.id,
        refresh_token_hash="",
        expires_at=now + timedelta(seconds=60 * 60 * 24 * 30),
    )
    db.add(session)
    db.flush()

    refresh_token = create_refresh_token(subject=str(user.id), session_id=str(session.id), now=now)
    session.refresh_token_hash = hash_api_key(refresh_token)
    access_token = create_access_token(subject=str(user.id), session_id=str(session.id), now=now)

    db.add(session)
    db.commit()

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


def _revoke_session_family(db: Session, family_id: uuid.UUID) -> None:
    """Revoke every session in a refresh-token family. Called when reuse is detected."""
    now = datetime.now(UTC)
    family_sessions = db.scalars(select(DbSession).where(DbSession.refresh_family_id == family_id)).all()
    for s in family_sessions:
        if s.revoked_at is None:
            s.revoked_at = now
            db.add(s)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("30/minute")
def refresh(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if decoded.get("typ") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = decoded.get("sub")
    session_id = decoded.get("sid")
    if not user_id or not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    db_session = db.get(DbSession, uuid.UUID(session_id))
    if not db_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

    now = datetime.now(UTC)

    # Reuse detection: if the session was already revoked OR the supplied hash doesn't match
    # the current hash, treat this as compromise and revoke the entire family.
    if db_session.revoked_at is not None or db_session.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    incoming_hash = hash_api_key(payload.refresh_token)
    if db_session.refresh_token_hash != incoming_hash:
        _revoke_session_family(db, db_session.refresh_family_id)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

    new_refresh_token = create_refresh_token(subject=user_id, session_id=session_id, now=now)
    db_session.refresh_token_hash = hash_api_key(new_refresh_token)
    db_session.last_used_at = now
    access_token = create_access_token(subject=user_id, session_id=session_id, now=now)
    db.add(db_session)
    db.commit()

    return TokenPair(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    user: User = Depends(get_current_user),
    session: DbSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> None:
    _ = user
    session.revoked_at = datetime.now(UTC)
    db.add(session)
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
