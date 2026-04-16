import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserRole

# Config from environment
import logging as _logging
logger = _logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

_jwt_secret: str = ""
_encryption_key: str = ""


def init_secrets():
    """Initialize secrets from environment. Called during app startup."""
    global _jwt_secret, _encryption_key
    _jwt_secret = os.getenv("JWT_SECRET", "")
    if not _jwt_secret or _jwt_secret == "CHANGE_ME_IN_PRODUCTION":
        raise RuntimeError("JWT_SECRET environment variable must be set to a secure value")
    _encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not _encryption_key or _encryption_key == "CHANGE_ME_fernet_key":
        raise RuntimeError("ENCRYPTION_KEY environment variable must be set to a valid Fernet key")


def get_jwt_secret() -> str:
    if not _jwt_secret:
        raise RuntimeError("Secrets not initialized. Call init_secrets() first.")
    return _jwt_secret


def get_encryption_key() -> str:
    if not _encryption_key:
        raise RuntimeError("Secrets not initialized. Call init_secrets() first.")
    return _encryption_key

ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, hash: str) -> bool:
    try:
        return ph.verify(hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: int, role: str, token_version: int = 0) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "ver": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def get_current_user(
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that extracts and validates the JWT from cookie."""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(access_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    token_ver = payload.get("ver", 0)
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if user.token_version != token_ver:
        raise HTTPException(status_code=401, detail="Token has been invalidated")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the current user to be an admin."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# Fernet encryption for DB-stored secrets (like IMAP passwords)
def get_fernet() -> Fernet:
    key = get_encryption_key()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value: str) -> str:
    """Encrypt a string value for DB storage."""
    f = get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    """Decrypt a DB-stored encrypted value."""
    if not value:
        return value
    f = get_fernet()
    try:
        return f.decrypt(value.encode()).decode()
    except Exception:
        logger.error("SECURITY: Failed to decrypt stored value. Encryption key may have changed.")
        raise ValueError("Cannot decrypt stored credential. Re-enter and save the credential to re-encrypt with the current key.")
