import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_api_key
from app.db import get_db
from app.deps import get_current_user, require_org_role
from app.models import Invite, Membership, Organization, OrgRole, User
from app.schemas import (
    InviteAccept,
    InviteCreate,
    InviteCreated,
    MembershipOut,
    OrganizationCreate,
    OrganizationOut,
)


router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_org(payload: OrganizationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = Organization(name=payload.name)
    db.add(org)
    db.flush()
    membership = Membership(organization_id=org.id, user_id=user.id, role=OrgRole.admin)
    db.add(membership)
    db.commit()
    db.refresh(org)
    return org


@router.get("", response_model=list[OrganizationOut])
def list_orgs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orgs = db.scalars(
        select(Organization)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id)
        .order_by(Organization.created_at.desc())
    ).all()
    return list(orgs)


@router.get("/{organization_id}/members", response_model=list[MembershipOut])
def list_members(
    organization_id: uuid.UUID,
    _membership: Membership = Depends(require_org_role(OrgRole.viewer)),
    db: Session = Depends(get_db),
):
    members = db.scalars(select(Membership).where(Membership.organization_id == organization_id)).all()
    return list(members)


@router.post("/{organization_id}/invites", response_model=InviteCreated, status_code=status.HTTP_201_CREATED)
def create_invite(
    organization_id: uuid.UUID,
    payload: InviteCreate,
    _membership: Membership = Depends(require_org_role(OrgRole.admin)),
    db: Session = Depends(get_db),
):
    token = f"inv_{secrets.token_urlsafe(32)}"
    token_hash = hash_api_key(token)
    invite = Invite(organization_id=organization_id, email=payload.email, role=payload.role, token_hash=token_hash)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return InviteCreated(
        id=invite.id,
        organization_id=invite.organization_id,
        email=invite.email,
        role=invite.role,
        created_at=invite.created_at,
        accepted_at=invite.accepted_at,
        token=token,
    )


@router.post("/invites/accept", response_model=MembershipOut)
def accept_invite(payload: InviteAccept, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invite = db.scalar(select(Invite).where(Invite.token_hash == hash_api_key(payload.token)))
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invite already accepted")
    existing = db.scalar(
        select(Membership).where(Membership.organization_id == invite.organization_id, Membership.user_id == user.id)
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member")

    membership = Membership(organization_id=invite.organization_id, user_id=user.id, role=invite.role)
    invite.accepted_at = datetime.now(UTC)
    db.add(membership)
    db.add(invite)
    db.commit()
    db.refresh(membership)
    return membership

