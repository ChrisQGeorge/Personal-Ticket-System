import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import User, UserRole
from ..schemas import UserResponse, UserUpdateRole, UserUpdateActive

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).all()


@router.put("/users/{user_id}/role")
def update_user_role(user_id: int, payload: UserUpdateRole, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot change your own role")
    user.role = payload.role
    db.commit()
    logger.warning("Admin '%s' changed user '%s' role to '%s'", admin.username, user.username, payload.role)
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/active")
def update_user_active(user_id: int, payload: UserUpdateActive, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot deactivate yourself")
    user.is_active = payload.is_active
    db.commit()
    logger.warning("Admin '%s' set user '%s' active=%s", admin.username, user.username, payload.is_active)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Cannot delete yourself")
    username = user.username
    db.delete(user)
    db.commit()
    logger.warning("Admin '%s' deleted user '%s'", admin.username, username)
    return {"message": "User deleted"}
