import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import config, queue, recurring, tickets
from .services.scheduler import scheduler_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and start scheduler
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created.")

    # Seed default QueueConfig if it doesn't exist
    from .database import SessionLocal
    from .models import QueueConfig
    db = SessionLocal()
    try:
        if db.query(QueueConfig).filter(QueueConfig.id == 1).first() is None:
            db.add(QueueConfig(id=1))
            db.commit()
            logger.info("Default QueueConfig seeded.")
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


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
