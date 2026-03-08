import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_api_key, new_api_key
from app.db import get_db
from app.deps import get_current_user
from app.models import ApiKey, Membership, Organization, OrgRole, Project, User
from app.schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyOut, ProjectCreate, ProjectOut


router = APIRouter(tags=["projects"])


def _require_project_role(db: Session, user_id: uuid.UUID, project: Project, min_role: OrgRole) -> Membership:
    order = {OrgRole.viewer: 0, OrgRole.developer: 1, OrgRole.admin: 2}
    membership = db.scalar(
        select(Membership).where(Membership.organization_id == project.organization_id, Membership.user_id == user_id)
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")
    if order[membership.role] < order[min_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return membership


@router.post("/orgs/{organization_id}/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    organization_id: uuid.UUID,
    payload: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.scalar(
        select(Membership).where(Membership.organization_id == organization_id, Membership.user_id == user.id)
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")
    if membership.role not in (OrgRole.admin, OrgRole.developer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

    org = db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    project = Project(organization_id=organization_id, name=payload.name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/orgs/{organization_id}/projects", response_model=list[ProjectOut])
def list_projects(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.scalar(
        select(Membership).where(Membership.organization_id == organization_id, Membership.user_id == user.id)
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    projects = db.scalars(select(Project).where(Project.organization_id == organization_id).order_by(Project.created_at.desc())).all()
    return list(projects)


@router.post("/projects/{project_id}/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key(
    project_id: uuid.UUID,
    payload: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _require_project_role(db, user.id, project, OrgRole.developer)

    plain = new_api_key()
    key_hash = hash_api_key(plain)
    api_key = ApiKey(project_id=project_id, name=payload.name, key_hash=key_hash)
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return ApiKeyCreated(
        id=api_key.id,
        project_id=api_key.project_id,
        name=api_key.name,
        created_at=api_key.created_at,
        revoked_at=api_key.revoked_at,
        last_used_at=api_key.last_used_at,
        api_key=plain,
    )


@router.get("/projects/{project_id}/api-keys", response_model=list[ApiKeyOut])
def list_api_keys(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _require_project_role(db, user.id, project, OrgRole.viewer)

    keys = db.scalars(select(ApiKey).where(ApiKey.project_id == project_id).order_by(ApiKey.created_at.desc())).all()
    return list(keys)


@router.delete("/projects/{project_id}/api-keys/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    project_id: uuid.UUID,
    api_key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _require_project_role(db, user.id, project, OrgRole.developer)

    api_key = db.get(ApiKey, api_key_id)
    if not api_key or api_key.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    api_key.revoked_at = datetime.now(UTC)
    db.add(api_key)
    db.commit()
    return None

