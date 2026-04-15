from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import QueueConfig
from ..schemas import QueueConfigResponse, QueueConfigUpdate

router = APIRouter(tags=["config"])


def _get_or_create_config(db: Session) -> QueueConfig:
    """Return the singleton QueueConfig row, creating it if absent."""
    config = db.query(QueueConfig).filter(QueueConfig.id == 1).first()
    if config is None:
        config = QueueConfig(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/config", response_model=QueueConfigResponse)
def get_config(db: Session = Depends(get_db)):
    """Return the current queue weight configuration."""
    return _get_or_create_config(db)


@router.put("/config", response_model=QueueConfigResponse)
def update_config(payload: QueueConfigUpdate, db: Session = Depends(get_db)):
    """Update queue weight configuration with the provided fields."""
    config = _get_or_create_config(db)
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


@router.post("/config/reset", response_model=QueueConfigResponse)
def reset_config(db: Session = Depends(get_db)):
    """Reset queue weight configuration back to defaults."""
    config = _get_or_create_config(db)
    defaults = QueueConfig(id=1)
    for col in QueueConfig.__table__.columns:
        if col.name == "id":
            continue
        setattr(config, col.name, col.default.arg)
    db.commit()
    db.refresh(config)
    return config
