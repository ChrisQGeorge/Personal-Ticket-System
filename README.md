# Personal Ticket System (PTS)

A self-hosted task management app that uses a weighted FIFO queue to decide what you should work on next, reducing decision fatigue and selection overhead.

## Features

- **Weighted FIFO Queue** -- tickets are served based on age, priority, due date, skip count, and estimated effort
- **Ticket CRUD** -- create, view, edit, and delete tickets with priority, due dates, time estimates, and related tickets
- **Queue Workflow** -- work through tickets one at a time: complete or skip, and the next one loads automatically
- **Recurring Tickets** -- define templates that auto-create tickets on a daily, weekly, or monthly schedule
- **Ticket Management** -- sortable, filterable table of all tickets with inline status management
- **Configurable Weights** -- tune the queue scoring algorithm through a settings page in the UI
- **Mobile Responsive** -- fully functional on both desktop and mobile browsers
- **Zero Config Startup** -- single `docker-compose up -d` command, no `.env` file required

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend  | FastAPI (Python), SQLAlchemy, Pydantic |
| Database | MySQL 8.0                           |
| Infra    | Docker, Docker Compose              |

## Quick Start

**Prerequisites:** Docker and Docker Compose installed on your machine.

```bash
git clone <repo-url>
cd Personal-Ticket-System
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser. That's it.

The first startup takes a couple of minutes while containers build and the database initializes. Subsequent starts are fast.

## Screens

- **Home** -- dashboard with quick stats (open, in-progress, completed, skipped counts) and buttons to create a ticket or start working the queue
- **Queue** -- displays the highest-priority ticket with its full details; Complete and Skip buttons at the bottom load the next ticket; shows an empty-state message when the queue is clear
- **Ticket List** -- sortable table of all tickets with columns for ID, title, status, priority, due date, and estimated hours; filter dropdowns for status and priority
- **Ticket Form** -- full form for creating or editing a ticket with all fields: title, description (markdown), priority dropdown, due date picker, estimated hours, and a related-tickets selector
- **Recurring Templates List** -- table of all recurring templates showing title, frequency, active status, and next fire date
- **Recurring Template Form** -- same fields as the ticket form plus an active toggle, frequency selector (daily/weekly/monthly), interval count, and start date
- **Queue Settings** -- sliders or inputs for all queue weight parameters with a reset-to-defaults button

## Project Structure

```
Personal-Ticket-System/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── entrypoint.sh
│   └── app/
│       ├── main.py              # FastAPI app, lifespan, CORS, router registration
│       ├── database.py          # SQLAlchemy engine and session
│       ├── models.py            # ORM models: Ticket, RecurringTemplate, QueueConfig
│       ├── schemas.py           # Pydantic request/response schemas
│       ├── routers/
│       │   ├── tickets.py       # /api/tickets CRUD
│       │   ├── queue.py         # /api/queue (next, complete, skip, stats)
│       │   ├── recurring.py     # /api/recurring CRUD
│       │   └── config.py        # /api/config (queue weight settings)
│       └── services/
│           ├── queue_service.py  # Scoring algorithm and queue ordering
│           └── scheduler.py      # Background loop for recurring ticket creation
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── page.tsx              # Home
        │   ├── layout.tsx            # Root layout with Navbar
        │   ├── queue/page.tsx        # Queue workflow
        │   ├── tickets/
        │   │   ├── page.tsx          # Ticket list
        │   │   ├── new/page.tsx      # Create ticket
        │   │   └── [id]/page.tsx     # Edit ticket
        │   └── recurring/
        │       ├── page.tsx          # Recurring list
        │       ├── new/page.tsx      # Create template
        │       └── [id]/page.tsx     # Edit template
        ├── components/
        │   ├── Navbar.tsx
        │   ├── TicketForm.tsx
        │   └── RecurringForm.tsx
        └── lib/
            ├── api.ts            # API client functions
            └── types.ts          # TypeScript interfaces
```

## Development

To run the frontend and backend separately for development (the database still runs in Docker):

```bash
# Start only the database
docker-compose up -d db

# Backend (Python 3.11+)
cd backend
pip install -r requirements.txt
DATABASE_URL="mysql+pymysql://pts_user:pts_pass_2024@localhost:3306/pts_db" \
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (Node 18+)
cd frontend
npm install
NEXT_PUBLIC_API_URL="http://localhost:8000" npm run dev
```

The frontend dev server runs on port 3000, the backend on port 8000.

## Configuration

### Queue Weights (UI)

Navigate to the Queue Settings page to adjust how tickets are scored. Each weight controls how much a factor influences queue order:

| Setting          | Default | Effect                                          |
|------------------|--------:|-------------------------------------------------|
| Age Weight       |    10.0 | Points per day since creation (higher = older tickets surface faster) |
| Skip Weight      |    15.0 | Points per skip (higher = skipped tickets return sooner) |
| Effort Weight    |     5.0 | Points per estimated hour (higher = quick tasks deprioritized less) |
| Due Date Weight  |     3.0 | Points per day until due (higher = deadlines matter more) |
| Overdue Penalty  |  -100.0 | Flat score for overdue tickets (more negative = stronger boost) |
| Priority Values  | -40 to +40 | Per-level score offset (more negative = higher priority) |

### Docker Compose Environment Variables

Defined in `docker-compose.yml` -- no `.env` file needed:

| Variable              | Container | Default |
|-----------------------|-----------|---------|
| `MYSQL_ROOT_PASSWORD` | db        | `pts_root_s3cret` |
| `MYSQL_DATABASE`      | db        | `pts_db` |
| `MYSQL_USER`          | db        | `pts_user` |
| `MYSQL_PASSWORD`      | db        | `pts_pass_2024` |
| `DATABASE_URL`        | backend   | `mysql+pymysql://pts_user:pts_pass_2024@db:3306/pts_db` |
| `BACKEND_URL`         | frontend  | `http://backend:8000` |

## API Reference

All endpoints are prefixed with `/api`.

### Tickets

| Method   | Endpoint            | Description                     |
|----------|---------------------|---------------------------------|
| `GET`    | `/api/tickets`      | List tickets (query: `status`, `priority`, `sort_by`, `sort_order`) |
| `POST`   | `/api/tickets`      | Create a ticket                 |
| `GET`    | `/api/tickets/:id`  | Get a ticket by ID              |
| `PUT`    | `/api/tickets/:id`  | Update a ticket                 |
| `DELETE` | `/api/tickets/:id`  | Delete a ticket                 |

### Queue

| Method   | Endpoint                  | Description                       |
|----------|---------------------------|-----------------------------------|
| `GET`    | `/api/queue/next`         | Get the next ticket in the queue  |
| `POST`   | `/api/queue/complete/:id` | Mark a ticket as completed        |
| `POST`   | `/api/queue/skip/:id`     | Skip a ticket (increments skip count) |
| `GET`    | `/api/queue/stats`        | Get ticket count stats by status  |

### Recurring Templates

| Method   | Endpoint              | Description                     |
|----------|-----------------------|---------------------------------|
| `GET`    | `/api/recurring`      | List all recurring templates    |
| `POST`   | `/api/recurring`      | Create a recurring template     |
| `GET`    | `/api/recurring/:id`  | Get a template by ID            |
| `PUT`    | `/api/recurring/:id`  | Update a template               |
| `DELETE` | `/api/recurring/:id`  | Delete a template               |

### Config

| Method   | Endpoint              | Description                         |
|----------|-----------------------|-------------------------------------|
| `GET`    | `/api/config`         | Get current queue weight config     |
| `PUT`    | `/api/config`         | Update queue weight config          |
| `POST`   | `/api/config/reset`   | Reset weights to defaults           |

### Health

| Method | Endpoint       | Description       |
|--------|----------------|-------------------|
| `GET`  | `/api/health`  | Health check      |

## License

MIT
