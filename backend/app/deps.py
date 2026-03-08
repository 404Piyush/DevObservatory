import uuid
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token, hash_api_key
from app.db import get_db
from app.models import ApiKey, Membership, OrgRole, Project, Session as DbSession, User


auth_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _forbidden(detail: str = "Forbidden") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise _unauthorized()
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise _unauthorized("Invalid token")

    if payload.get("typ") != "access":
        raise _unauthorized("Invalid token type")

    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise _unauthorized("Invalid token payload")

    db_session = db.get(DbSession, uuid.UUID(session_id))
    if not db_session or db_session.revoked_at is not None or db_session.expires_at <= datetime.now(UTC):
        raise _unauthorized("Session expired")

    user = db.get(User, uuid.UUID(user_id))
    if not user or not user.is_active:
        raise _unauthorized("User inactive")

    return user


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> DbSession:
    if not credentials:
        raise _unauthorized()
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError:
        raise _unauthorized("Invalid token")

    if payload.get("typ") != "access":
        raise _unauthorized("Invalid token type")

    session_id = payload.get("sid")
    if not session_id:
        raise _unauthorized("Invalid token payload")

    db_session = db.get(DbSession, uuid.UUID(session_id))
    if not db_session:
        raise _unauthorized("Session not found")
    return db_session


def require_org_role(min_role: OrgRole):
    order = {OrgRole.viewer: 0, OrgRole.developer: 1, OrgRole.admin: 2}

    def _dep(
        organization_id: uuid.UUID,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Membership:
        membership = db.scalar(
            select(Membership).where(Membership.organization_id == organization_id, Membership.user_id == user.id)
        )
        if not membership:
            raise _forbidden("Not a member of this organization")
        if order[membership.role] < order[min_role]:
            raise _forbidden("Insufficient role")
        return membership

    return _dep


def get_project_by_id(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def get_project_from_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Project:
    if not x_api_key:
        raise _unauthorized("Missing X-API-Key")
    key_hash = hash_api_key(x_api_key)
    api_key = db.scalar(select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None)))
    if not api_key:
        raise _unauthorized("Invalid API key")
    api_key.last_used_at = datetime.now(UTC)
    db.add(api_key)
    db.flush()
    project = db.get(Project, api_key.project_id)
    if not project:
        raise _unauthorized("Invalid API key")
    return project
