from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User, UserGameStats
from ..services.gamification import get_stats_response, get_or_create_stats

router = APIRouter(prefix="/gamification", tags=["gamification"])


class ToggleRequest(BaseModel):
    enabled: bool


@router.get("/stats")
def get_game_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_stats_response(db, user.id)


@router.post("/toggle")
def toggle_gamification(payload: ToggleRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stats = get_or_create_stats(db, user.id)
    stats.gamification_enabled = payload.enabled
    db.commit()
    return {"gamification_enabled": stats.gamification_enabled}
