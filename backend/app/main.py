import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import backup, config, imports, profiles, queue, recurring, tickets
from .services.scheduler import scheduler_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and start scheduler
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created.")

    # Run lightweight migrations for columns added after initial schema
    from sqlalchemy import text, inspect
    from .database import SessionLocal
    from .models import Profile, QueueConfig, RecurringTemplate, Ticket

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

        # Seed default profile
        if db.query(Profile).count() == 0:
            db.add(Profile(name="Default", color="#6366f1"))
            db.commit()
            logger.info("Default profile seeded.")

        # Assign orphan tickets/templates to the default profile
        default_profile = db.query(Profile).filter(Profile.name == "Default").first()
        if default_profile:
            db.query(Ticket).filter(Ticket.profile_id.is_(None)).update(
                {"profile_id": default_profile.id}
            )
            db.query(RecurringTemplate).filter(
                RecurringTemplate.profile_id.is_(None)
            ).update({"profile_id": default_profile.id})
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

# CORS - allow all origins (personal app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tickets.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(recurring.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(backup.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
