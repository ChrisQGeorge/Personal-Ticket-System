import imaplib
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, encrypt_value, decrypt_value
from ..database import get_db
from ..models import Profile, Ticket, RecurringTemplate, User
from ..schemas import ProfileCreate, ProfileResponse, ProfileUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _profile_to_response(profile: Profile) -> ProfileResponse:
    return ProfileResponse(
        id=profile.id,
        name=profile.name,
        color=profile.color,
        user_id=profile.user_id,
        imap_host=profile.imap_host,
        imap_port=profile.imap_port,
        imap_user=profile.imap_user,
        imap_use_ssl=profile.imap_use_ssl,
        email_enabled=profile.email_enabled,
        has_password=bool(profile.imap_password),
    )


def _verify_profile_ownership(db: Session, profile_id: int, user: User) -> Profile:
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.get("", response_model=list[ProfileResponse])
def list_profiles(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profiles = db.query(Profile).filter(Profile.user_id == user.id).all()
    return [_profile_to_response(p) for p in profiles]


@router.post("", response_model=ProfileResponse, status_code=201)
def create_profile(
    payload: ProfileCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(Profile).filter(
        Profile.name == payload.name,
        Profile.user_id == user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Profile with this name already exists")
    profile = Profile(
        name=payload.name,
        color=payload.color or "#6366f1",
        user_id=user.id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _profile_to_response(profile)


@router.get("/{profile_id}", response_model=ProfileResponse)
def get_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = _verify_profile_ownership(db, profile_id, user)
    return _profile_to_response(profile)


@router.put("/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: int,
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = _verify_profile_ownership(db, profile_id, user)

    update_data = payload.model_dump(exclude_unset=True)

    # Encrypt IMAP password before storing
    if "imap_password" in update_data and update_data["imap_password"] is not None:
        update_data["imap_password"] = encrypt_value(update_data["imap_password"])

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _profile_to_response(profile)


@router.delete("/{profile_id}", status_code=204)
def delete_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = _verify_profile_ownership(db, profile_id, user)

    ticket_count = db.query(Ticket).filter(Ticket.profile_id == profile_id).count()
    template_count = db.query(RecurringTemplate).filter(RecurringTemplate.profile_id == profile_id).count()
    if ticket_count > 0 or template_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete profile that has tickets or recurring templates. Reassign them first.",
        )

    db.delete(profile)
    db.commit()
    return None


@router.post("/{profile_id}/test-email")
def test_email(
    profile_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Test the IMAP connection for a profile."""
    profile = _verify_profile_ownership(db, profile_id, user)

    if not profile.imap_host or not profile.imap_user or not profile.imap_password:
        return {"success": False, "message": "IMAP credentials are not fully configured."}

    try:
        password = decrypt_value(profile.imap_password)

        if profile.imap_use_ssl:
            mail = imaplib.IMAP4_SSL(profile.imap_host, profile.imap_port or 993)
        else:
            mail = imaplib.IMAP4(profile.imap_host, profile.imap_port or 143)

        mail.login(profile.imap_user, password)
        mail.select("INBOX")
        mail.logout()
        return {"success": True, "message": "IMAP connection successful."}
    except imaplib.IMAP4.error as e:
        logger.warning("IMAP test failed for profile %d: %s", profile_id, e)
        return {"success": False, "message": "IMAP authentication failed. Check your credentials."}
    except Exception as e:
        logger.warning("IMAP test failed for profile %d: %s", profile_id, e)
        return {"success": False, "message": "Connection failed. Check your server settings."}
