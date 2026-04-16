from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Frequency, Priority, Profile, RecurringTemplate, User
from ..schemas import (
    RecurringTemplateCreate,
    RecurringTemplateResponse,
    RecurringTemplateUpdate,
)
from ..services.scheduler import compute_next_fire

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _template_to_response(template: RecurringTemplate) -> RecurringTemplateResponse:
    return RecurringTemplateResponse(
        id=template.id,
        title=template.title,
        description=template.description,
        priority=template.priority.value if isinstance(template.priority, Priority) else template.priority,
        est_hours=template.est_hours,
        active=template.active,
        frequency=template.frequency.value if isinstance(template.frequency, Frequency) else template.frequency,
        interval_count=template.interval_count,
        start_date=template.start_date,
        last_fired=template.last_fired,
        next_fire=template.next_fire,
        profile_id=template.profile_id,
        due_in_days=template.due_in_days,
    )


def _verify_profile_ownership(db: Session, profile_id: int, user: User):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=403, detail="Profile does not belong to you")
    return profile


def _verify_template_ownership(db: Session, template_id: int, user: User) -> RecurringTemplate:
    template = (
        db.query(RecurringTemplate)
        .join(Profile)
        .filter(RecurringTemplate.id == template_id, Profile.user_id == user.id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=list[RecurringTemplateResponse])
def list_templates(
    profile_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(RecurringTemplate).join(Profile).filter(Profile.user_id == user.id)
    if profile_id is not None:
        _verify_profile_ownership(db, profile_id, user)
        query = query.filter(RecurringTemplate.profile_id == profile_id)
    templates = query.all()
    return [_template_to_response(t) for t in templates]


@router.post("", response_model=RecurringTemplateResponse, status_code=201)
def create_template(
    payload: RecurringTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.profile_id is not None:
        _verify_profile_ownership(db, payload.profile_id, user)
        profile_id = payload.profile_id
    else:
        default_profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        if not default_profile:
            raise HTTPException(400, "No profile found. Create a profile first.")
        profile_id = default_profile.id

    template = RecurringTemplate(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        est_hours=payload.est_hours,
        frequency=payload.frequency,
        interval_count=payload.interval_count,
        start_date=payload.start_date,
        profile_id=profile_id,
        due_in_days=payload.due_in_days,
    )
    # Compute initial next_fire
    template.next_fire = compute_next_fire(template)
    db.add(template)
    db.commit()
    db.refresh(template)
    return _template_to_response(template)


@router.get("/{template_id}", response_model=RecurringTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = _verify_template_ownership(db, template_id, user)
    return _template_to_response(template)


@router.put("/{template_id}", response_model=RecurringTemplateResponse)
def update_template(
    template_id: int,
    payload: RecurringTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = _verify_template_ownership(db, template_id, user)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    # Recompute next_fire if scheduling fields changed
    scheduling_fields = {"frequency", "interval_count", "start_date"}
    if scheduling_fields & update_data.keys():
        template.next_fire = compute_next_fire(template)

    db.commit()
    db.refresh(template)
    return _template_to_response(template)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = _verify_template_ownership(db, template_id, user)
    db.delete(template)
    db.commit()
    return None
