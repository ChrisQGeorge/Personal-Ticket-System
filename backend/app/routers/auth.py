import logging
import os
import time
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..database import get_db
from ..models import User, UserRole, Profile
from ..schemas import ChangePasswordRequest, LoginRequest, RegisterRequest, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

_login_attempts: dict[str, list[float]] = defaultdict(list)
_login_lock = Lock()
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300  # 5 minutes

_ip_attempts: dict[str, list[float]] = defaultdict(list)
_ip_lock = Lock()
MAX_IP_ATTEMPTS = 20  # 20 attempts per IP per window
IP_WINDOW_SECONDS = 300


def _check_ip_rate_limit(request: Request) -> None:
    """Rate limit by client IP."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    with _ip_lock:
        attempts = _ip_attempts[client_ip]
        _ip_attempts[client_ip] = [t for t in attempts if now - t < IP_WINDOW_SECONDS]
        if len(_ip_attempts[client_ip]) >= MAX_IP_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
        _ip_attempts[client_ip].append(now)


def _check_rate_limit(key: str) -> None:
    """Raise 429 if too many attempts in the window."""
    now = time.time()
    with _login_lock:
        attempts = _login_attempts[key]
        # Prune old attempts
        _login_attempts[key] = [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]
        if len(_login_attempts[key]) >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        _login_attempts[key].append(now)


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _check_ip_rate_limit(request)
    _check_rate_limit(payload.username)

    user = db.query(User).filter(User.username == payload.username).first()
    if user is None:
        # Run hash anyway to prevent timing-based username enumeration
        hash_password("dummy_password_for_timing")
        logger.warning("Failed login attempt for username '%s'", payload.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    if not verify_password(payload.password, user.password_hash):
        logger.warning("Failed login attempt for username '%s'", payload.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id, user.role.value, user.token_version)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
        secure=COOKIE_SECURE,
        path="/",
    )
    logger.info("User '%s' logged in successfully", user.username)
    return {"message": "Login successful", "user": UserResponse.model_validate(user)}


@router.post("/register")
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _check_ip_rate_limit(request)
    _check_rate_limit(f"register:{payload.username}")

    # Check if username taken
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Registration failed")

    # First user is admin
    user_count = db.query(User).count()
    role = UserRole.ADMIN if user_count == 0 else UserRole.USER

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a default profile for the new user
    default_profile = Profile(name=f"Default ({user.username})", color="#6366f1", user_id=user.id)
    db.add(default_profile)
    db.commit()

    # Auto-login after registration
    token = create_access_token(user.id, user.role.value, user.token_version)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
        secure=COOKIE_SECURE,
        path="/",
    )
    logger.info("New user registered: '%s' (role: %s)", user.username, role.value)
    return {"message": "Registration successful", "user": UserResponse.model_validate(user)}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    db.commit()
    # Issue new token with updated version
    token = create_access_token(user.id, user.role.value, user.token_version)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
        secure=COOKIE_SECURE,
        path="/",
    )
    logger.info("User '%s' changed their password", user.username)
    return {"message": "Password changed successfully"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)
