from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Frequency, Priority, RecurringTemplate
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
    )


@router.get("", response_model=list[RecurringTemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(RecurringTemplate).all()
    return [_template_to_response(t) for t in templates]


@router.post("", response_model=RecurringTemplateResponse, status_code=201)
def create_template(payload: RecurringTemplateCreate, db: Session = Depends(get_db)):
    template = RecurringTemplate(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        est_hours=payload.est_hours,
        frequency=payload.frequency,
        interval_count=payload.interval_count,
        start_date=payload.start_date,
    )
    # Compute initial next_fire
    template.next_fire = compute_next_fire(template)
    db.add(template)
    db.commit()
    db.refresh(template)
    return _template_to_response(template)


@router.get("/{template_id}", response_model=RecurringTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(RecurringTemplate).filter(RecurringTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_response(template)


@router.put("/{template_id}", response_model=RecurringTemplateResponse)
def update_template(
    template_id: int,
    payload: RecurringTemplateUpdate,
    db: Session = Depends(get_db),
):
    template = db.query(RecurringTemplate).filter(RecurringTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

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
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(RecurringTemplate).filter(RecurringTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return None
