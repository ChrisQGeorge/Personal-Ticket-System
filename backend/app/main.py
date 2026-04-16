import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .database import Base, engine
from .routers import admin, auth, backup, config, gamification, imports, profiles, queue, recurring, tickets
from .services.scheduler import scheduler_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate secrets before anything else
    from .auth import init_secrets
    logger.info("Initializing secrets...")
    init_secrets()

    # Create tables and start scheduler
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created.")

    # Run lightweight migrations for columns added after initial schema
    from sqlalchemy import text, inspect
    from .database import SessionLocal
    from .models import Profile, QueueConfig, RecurringTemplate, Ticket, User, UserGameStats, UserRole

    db = SessionLocal()
    try:
        inspector = inspect(engine)

        # Add profile_id to tickets if missing
        ticket_cols = {c["name"] for c in inspector.get_columns("tickets")}
        if "profile_id" not in ticket_cols:
            db.execute(text("ALTER TABLE tickets ADD COLUMN profile_id INTEGER NULL"))
            db.execute(text("ALTER TABLE tickets ADD CONSTRAINT fk_tickets_profile FOREIGN KEY (profile_id) REFERENCES profiles(id)"))
            db.commit()
            logger.info("Added profile_id column to tickets table.")

        # Add profile_id to recurring_templates if missing
        recurring_cols = {c["name"] for c in inspector.get_columns("recurring_templates")}
        if "profile_id" not in recurring_cols:
            db.execute(text("ALTER TABLE recurring_templates ADD COLUMN profile_id INTEGER NULL"))
            db.execute(text("ALTER TABLE recurring_templates ADD CONSTRAINT fk_recurring_profile FOREIGN KEY (profile_id) REFERENCES profiles(id)"))
            db.commit()
            logger.info("Added profile_id column to recurring_templates table.")
        if "due_in_days" not in recurring_cols:
            db.execute(text("ALTER TABLE recurring_templates ADD COLUMN due_in_days INTEGER NULL"))
            db.commit()
            logger.info("Added due_in_days column to recurring_templates table.")

        # Add user_id to profiles if missing
        profile_cols = {c["name"] for c in inspector.get_columns("profiles")}
        if "user_id" not in profile_cols:
            db.execute(text("ALTER TABLE profiles ADD COLUMN user_id INTEGER NULL"))
            db.execute(text("ALTER TABLE profiles ADD CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)"))
            db.commit()
            logger.info("Added user_id column to profiles table.")

        # Add token_version to users if missing
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        if "token_version" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))
            db.commit()
            logger.info("Added token_version column to users table.")

        # Add total_created to user_game_stats if missing
        if "user_game_stats" in inspector.get_table_names():
            game_cols = {c["name"] for c in inspector.get_columns("user_game_stats")}
            if "total_created" not in game_cols:
                db.execute(text("ALTER TABLE user_game_stats ADD COLUMN total_created INTEGER NOT NULL DEFAULT 0"))
                db.commit()
                logger.info("Added total_created column to user_game_stats table.")

        # Widen imap_password column if it's too narrow for encrypted values
        try:
            db.execute(text("ALTER TABLE profiles MODIFY COLUMN imap_password VARCHAR(512) NULL"))
            db.commit()
            logger.info("Widened imap_password column.")
        except Exception:
            db.rollback()

    except Exception:
        logger.exception("Migration step failed (may be harmless if columns already exist)")
        db.rollback()
    finally:
        db.close()

    # Seed default QueueConfig if it doesn't exist
    db = SessionLocal()
    try:
        if db.query(QueueConfig).filter(QueueConfig.id == 1).first() is None:
            db.add(QueueConfig(id=1))
            db.commit()
            logger.info("Default QueueConfig seeded.")

        # Assign orphan profiles (user_id IS NULL) to the first admin user if one exists
        orphan_profiles = db.query(Profile).filter(Profile.user_id.is_(None)).all()
        if orphan_profiles:
            admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if admin_user:
                for p in orphan_profiles:
                    p.user_id = admin_user.id
                db.commit()
                logger.info(
                    "Assigned %d orphan profiles to admin user '%s'.",
                    len(orphan_profiles),
                    admin_user.username,
                )

        # Assign orphan tickets/templates to a default profile if needed
        first_profile = db.query(Profile).first()
        if first_profile:
            db.query(Ticket).filter(Ticket.profile_id.is_(None)).update(
                {"profile_id": first_profile.id}
            )
            db.query(RecurringTemplate).filter(
                RecurringTemplate.profile_id.is_(None)
            ).update({"profile_id": first_profile.id})
            db.commit()
    finally:
        db.close()

    logger.info("Starting recurring template scheduler...")
    scheduler_task = asyncio.create_task(scheduler_loop())

    yield

    # Shutdown: cancel scheduler
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        logger.info("Scheduler stopped.")


app = FastAPI(
    title="Personal Ticket System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - restrict origins via environment variable
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Server"] = "PTS"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(recurring.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(gamification.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
