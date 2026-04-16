import imaplib
import ipaddress
import email
import logging
import socket
from email.header import decode_header
from html.parser import HTMLParser

from ..auth import decrypt_value
from ..database import SessionLocal
from ..models import Profile, Ticket

logger = logging.getLogger(__name__)


class HTMLStripper(HTMLParser):
    """Strip HTML tags, keeping text content."""

    def __init__(self):
        super().__init__()
        self.result = []

    def handle_data(self, data):
        self.result.append(data)

    def get_text(self):
        return "".join(self.result)


def strip_html(html_content: str) -> str:
    stripper = HTMLStripper()
    stripper.feed(html_content)
    return stripper.get_text().strip()


def decode_email_subject(msg) -> str:
    subject = msg.get("Subject", "")
    decoded_parts = decode_header(subject)
    parts = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            parts.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(part)
    return " ".join(parts).strip()


def get_email_body(msg) -> str:
    """Extract plaintext body from email, stripping HTML if needed."""
    if msg.is_multipart():
        plain = None
        html = None
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == "text/plain" and not plain:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                plain = payload.decode(charset, errors="replace")
            elif content_type == "text/html" and not html:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                html = payload.decode(charset, errors="replace")
        if plain:
            return plain.strip()
        if html:
            return strip_html(html)
        return ""
    else:
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace") if payload else ""
        if msg.get_content_type() == "text/html":
            return strip_html(text)
        return text.strip()


def _is_safe_host(host: str) -> bool:
    """Check if host is safe (not internal/private)."""
    blocked = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "db", "backend", "frontend", "pts_db", "pts_backend", "pts_frontend"}
    if host.lower().strip() in blocked:
        return False
    if host.lower().endswith((".internal", ".local")):
        return False
    try:
        resolved = socket.getaddrinfo(host, None)
        for family, type_, proto, canonname, sockaddr in resolved:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                return False
    except Exception:
        pass
    return True


def check_profile_email(profile_id: int) -> None:
    """Check IMAP inbox for a profile and create tickets from unread emails."""
    db = SessionLocal()
    try:
        profile = db.query(Profile).filter(Profile.id == profile_id).first()
        if not profile or not profile.email_enabled:
            return
        if not profile.imap_host or not profile.imap_user or not profile.imap_password:
            return

        if not _is_safe_host(profile.imap_host):
            logger.warning("Blocked SSRF attempt: profile %d has internal IMAP host '%s'", profile_id, profile.imap_host)
            return

        # Connect to IMAP
        try:
            password = decrypt_value(profile.imap_password)
        except ValueError:
            logger.error("Cannot decrypt IMAP password for profile %d — skipping", profile_id)
            return
        mail = None
        try:
            if profile.imap_use_ssl:
                mail = imaplib.IMAP4_SSL(profile.imap_host, profile.imap_port or 993)
            else:
                mail = imaplib.IMAP4(profile.imap_host, profile.imap_port or 143)

            mail.login(profile.imap_user, password)
            mail.select("INBOX")

            # Search for unread/unseen messages
            status, messages = mail.search(None, "UNSEEN")
            if status != "OK":
                logger.warning("IMAP search failed for profile %d", profile_id)
                return

            msg_nums = messages[0].split()
            for num in msg_nums:
                try:
                    status, msg_data = mail.fetch(num, "(RFC822)")
                    if status != "OK":
                        continue
                    raw = msg_data[0][1]
                    msg = email.message_from_bytes(raw)

                    subject = decode_email_subject(msg) or "Untitled Email Ticket"
                    body = get_email_body(msg)

                    ticket = Ticket(
                        title=subject[:255],
                        description=body if body else None,
                        profile_id=profile.id,
                        priority="default",
                        status="open",
                    )
                    db.add(ticket)
                    db.commit()

                    # Mark as read (add Seen flag)
                    mail.store(num, "+FLAGS", "\\Seen")
                    logger.info(
                        "Created ticket from email: '%s' for profile %d",
                        subject[:50],
                        profile_id,
                    )
                except Exception:
                    logger.exception(
                        "Failed to process email %s for profile %d", num, profile_id
                    )
        finally:
            if mail:
                try:
                    mail.logout()
                except Exception:
                    pass
    except imaplib.IMAP4.error:
        logger.exception("IMAP connection failed for profile %d", profile_id)
    except Exception:
        logger.exception("Email check failed for profile %d", profile_id)
    finally:
        db.close()


def check_all_email_profiles() -> None:
    """Check email for all profiles that have email enabled."""
    db = SessionLocal()
    try:
        profiles = (
            db.query(Profile)
            .filter(
                Profile.email_enabled.is_(True),
                Profile.imap_host.isnot(None),
                Profile.imap_user.isnot(None),
                Profile.imap_password.isnot(None),
            )
            .all()
        )
        profile_ids = [p.id for p in profiles]
    finally:
        db.close()

    for pid in profile_ids:
        check_profile_email(pid)
