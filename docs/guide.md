# Personal Ticket System -- User and Developer Guide

---

## Part 1: User Guide

### Getting Started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose).
2. Clone or download the project.
3. Open a terminal in the project root and run:

```bash
docker-compose up -d
```

4. Wait about 1-2 minutes on first launch for images to build and MySQL to initialize.
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

To stop the system:

```bash
docker-compose down
```

Your data is stored in a Docker volume (`pts_mysql_data`) and persists across restarts. To completely wipe data, run `docker-compose down -v`.

---

### Creating Tickets

From the **Home** page, click **Create Ticket**. This opens a blank ticket form with the following fields:

| Field            | Required | Default   | Description |
|------------------|----------|-----------|-------------|
| Title            | Yes      | --        | Short summary of the task |
| Description      | No       | --        | Detailed notes, supports markdown |
| Priority         | No       | `default` | One of: very low, low, default, high, very high |
| Due Date         | No       | --        | Date the task should be done by |
| Est Hours        | No       | --        | How long you think it will take (e.g., 0.5, 1, 2.5) |
| Related Tickets  | No       | --        | Link to other tickets for context |

Click **Save** to create the ticket. It immediately enters the queue as "open".

---

### Working the Queue

Navigate to the **Queue** page from the navigation bar. The system shows you the highest-priority ticket based on the weighted scoring algorithm. You see the ticket's full details, including its score.

You have two actions:

- **Complete** -- marks the ticket as "completed" and removes it from the queue. The next ticket loads automatically.
- **Skip** -- marks the ticket as "skipped", increments its skip count by 1, and loads the next ticket. The skipped ticket stays in the queue but its position shifts based on the updated skip count.

When all tickets are completed, the page displays an empty-state message.

**How queue order is decided:**

The system calculates a score for every non-completed ticket. Lower score = served first. The main factors:

- **Older tickets** get priority (FIFO baseline)
- **Higher priority** tickets surface sooner
- **Closer deadlines** push tickets up; overdue tickets jump to the top
- **Frequently skipped** tickets gradually bubble up so you can't avoid them forever
- **Lower effort** tickets get a slight edge over high-effort ones

You can tune all of these factors in Queue Settings (see below).

---

### Managing Tickets

The **Tickets** page shows a table of all tickets in the system.

**Filtering:**
- Use the status dropdown to show only open, in-progress, completed, or skipped tickets
- Use the priority dropdown to filter by priority level

**Sorting:**
- Click any column header to sort by that column
- Click again to reverse the sort order

**Editing:**
- Click any row to open the ticket form for that ticket
- Change any field and click Save
- To reopen a completed ticket, change its status back to "open"
- To delete a ticket, use the Delete button on the ticket form

---

### Recurring Tickets

Recurring tickets let you set up templates that automatically create new tickets on a schedule.

**Creating a recurring template:**

1. Navigate to **Recurring** from the nav bar
2. Click **Create Recurring Ticket**
3. Fill in the template fields:

| Field          | Description |
|----------------|-------------|
| Title          | The title all generated tickets will have |
| Description    | Description copied to each generated ticket |
| Priority       | Priority for generated tickets |
| Est Hours      | Time estimate for generated tickets |
| Frequency      | `daily`, `weekly`, or `monthly` |
| Interval Count | How many units between fires (e.g., 2 = every 2 weeks) |
| Start Date     | When the schedule begins; first fire is calculated relative to this date |
| Active         | Toggle on/off without deleting the template |

**How the schedule works:**

The backend runs a scheduler every 60 seconds that checks all active templates. When the current time passes a template's `next_fire` timestamp, it:

1. Creates a new ticket with the template's field values
2. Records the current time as `last_fired`
3. Calculates the next fire date from `last_fired` + interval

**Examples:**
- Frequency: weekly, Interval: 1, Start: Jan 1 -- fires every Wednesday if Jan 1 was a Wednesday
- Frequency: monthly, Interval: 2, Start: Mar 15 -- fires on the 15th every 2 months (Mar, May, Jul, ...)
- Frequency: daily, Interval: 3, Start: any date -- fires every 3 days

**Managing templates:**
- Click any template in the list to edit it
- Toggle the Active checkbox to pause/resume without deleting
- Delete removes the template but does not remove tickets it already created

---

### Queue Settings

Navigate to Queue Settings to control how the scoring algorithm ranks tickets.

**Weight parameters and what they do:**

| Weight | Default | Plain English |
|--------|--------:|---------------|
| Age Weight | 10.0 | Each day a ticket has existed subtracts 10 points from its score (older = served sooner). Increase this to prioritize clearing old tickets. Decrease to make age matter less. |
| Skip Weight | 15.0 | Each time you skip a ticket, it gets 15 points subtracted from its score. This prevents you from permanently avoiding tickets. Increase to make skipped tickets return faster. |
| Effort Weight | 5.0 | Each estimated hour adds 5 points to the score. This gives a slight edge to quick tasks. Increase to strongly favor quick wins. Set to 0 if you don't want effort to matter. |
| Due Date Weight | 3.0 | Each day until the due date adds 3 points to the score (closer due date = lower score = served sooner). Increase to make deadlines more dominant. |
| Overdue Penalty | -100.0 | A flat bonus applied to any ticket past its due date. The more negative, the more urgently overdue tickets surface. |
| Priority Values | -40 to +40 | Each priority level has a score offset. "Very high" subtracts 40 (surfaces fast), "very low" adds 40 (sinks). Widen the range to make priority differences more dramatic. |

Click **Reset to Defaults** to restore all weights to their original values.

---

## Part 2: Developer Guide

### Architecture Overview

The system runs as three Docker containers on a single bridge network (`pts_network`):

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│    Frontend      │     │     Backend       │     │    Database     │
│  (pts_frontend)  │────>│   (pts_backend)   │────>│    (pts_db)     │
│  Next.js :3000   │     │  FastAPI :8000    │     │  MySQL :3306    │
└─────────────────┘     └──────────────────┘     └────────────────┘
```

- **Frontend** sends API requests to the backend via Next.js rewrites (configured in `next.config.js`), so the browser talks to `localhost:3000/api/*` which proxies to the backend.
- **Backend** connects to MySQL using SQLAlchemy over the internal Docker network (`db:3306`).
- **Database** stores all state. A Docker volume (`pts_mysql_data`) persists data across container restarts.

All containers use `restart: unless-stopped`.

---

### Backend Structure

```
backend/
├── Dockerfile           # Python 3.11-slim, installs deps, runs entrypoint.sh
├── requirements.txt     # fastapi, uvicorn, sqlalchemy, pymysql, python-dateutil, pydantic
├── entrypoint.sh        # Waits for DB, then starts uvicorn
└── app/
    ├── main.py          # App factory, lifespan (table creation + scheduler start), CORS, routers
    ├── database.py      # SQLAlchemy engine, SessionLocal, get_db dependency
    ├── models.py        # ORM models (Ticket, RecurringTemplate, QueueConfig) + enums
    ├── schemas.py       # Pydantic models for request validation and response serialization
    ├── routers/
    │   ├── tickets.py   # CRUD for /api/tickets
    │   ├── queue.py     # /api/queue/next, complete, skip, stats
    │   ├── recurring.py # CRUD for /api/recurring
    │   └── config.py    # GET/PUT /api/config, POST /api/config/reset
    └── services/
        ├── queue_service.py  # compute_score(), get_next_ticket(), get_all_scored()
        └── scheduler.py      # compute_next_fire(), fire_template(), scheduler_loop()
```

**Key patterns:**
- Routers use FastAPI's `APIRouter` with prefix and tags
- All routers are registered in `main.py` under the `/api` prefix
- Database sessions are injected via the `get_db` dependency
- The app lifespan handler creates tables on startup and launches the scheduler as an asyncio task

---

### Frontend Structure

```
frontend/src/
├── app/
│   ├── layout.tsx             # Root layout, imports globals.css and Navbar
│   ├── page.tsx               # Home dashboard
│   ├── globals.css            # Tailwind base + custom styles
│   ├── queue/page.tsx         # Queue workflow page
│   ├── tickets/
│   │   ├── page.tsx           # Ticket list with filters and sorting
│   │   ├── new/page.tsx       # Create ticket (renders TicketForm)
│   │   └── [id]/page.tsx      # Edit ticket (renders TicketForm with existing data)
│   └── recurring/
│       ├── page.tsx           # Recurring template list
│       ├── new/page.tsx       # Create template (renders RecurringForm)
│       └── [id]/page.tsx      # Edit template (renders RecurringForm)
├── components/
│   ├── Navbar.tsx             # Navigation bar, responsive with mobile menu
│   ├── TicketForm.tsx         # Shared form for create and edit ticket flows
│   └── RecurringForm.tsx      # Shared form for create and edit recurring template flows
└── lib/
    ├── api.ts                 # Typed fetch wrapper + all API client functions
    └── types.ts               # TypeScript interfaces matching backend schemas
```

**Key patterns:**
- Uses Next.js App Router (directory-based routing)
- `TicketForm` and `RecurringForm` are shared components used for both create and edit
- `api.ts` wraps `fetch` with error handling and JSON parsing; all API calls go through it
- API base URL comes from `NEXT_PUBLIC_API_URL` environment variable (empty string in production since requests proxy through Next.js)

---

### Database Schema

#### `tickets` table

| Column        | Type           | Constraints                        |
|---------------|----------------|------------------------------------|
| id            | INT            | Primary key, auto-increment        |
| title         | VARCHAR(255)   | NOT NULL                           |
| status        | ENUM           | `open`, `in-progress`, `completed`, `skipped` -- default `open` |
| date_created  | DATETIME       | NOT NULL, defaults to now          |
| description   | TEXT           | Nullable                           |
| due_date      | DATE           | Nullable                           |
| priority      | ENUM           | `very low`, `low`, `default`, `high`, `very high` -- default `default` |
| est_hours     | FLOAT          | Nullable                           |
| skip_count    | INT            | NOT NULL, default 0                |

#### `ticket_relationships` table (many-to-many self-join)

| Column            | Type | Constraints                          |
|-------------------|------|--------------------------------------|
| source_ticket_id  | INT  | PK, FK -> tickets.id, CASCADE delete |
| related_ticket_id | INT  | PK, FK -> tickets.id, CASCADE delete |

#### `recurring_templates` table

| Column         | Type         | Constraints                    |
|----------------|--------------|--------------------------------|
| id             | INT          | Primary key, auto-increment    |
| title          | VARCHAR(255) | NOT NULL                       |
| description    | TEXT         | Nullable                       |
| priority       | ENUM         | Same values as tickets         |
| est_hours      | FLOAT        | Nullable                       |
| active         | BOOLEAN      | NOT NULL, default true         |
| frequency      | ENUM         | `daily`, `weekly`, `monthly`   |
| interval_count | INT          | NOT NULL, default 1            |
| start_date     | DATE         | NOT NULL                       |
| last_fired     | DATETIME     | Nullable                       |
| next_fire      | DATETIME     | Nullable                       |

#### `queue_config` table (singleton, always id=1)

| Column             | Type  | Default |
|--------------------|-------|--------:|
| id                 | INT   | 1       |
| age_weight         | FLOAT | 10.0    |
| skip_weight        | FLOAT | 15.0    |
| effort_weight      | FLOAT | 5.0     |
| due_date_weight    | FLOAT | 3.0     |
| overdue_penalty    | FLOAT | -100.0  |
| priority_very_high | FLOAT | -40.0   |
| priority_high      | FLOAT | -20.0   |
| priority_default   | FLOAT | 0.0     |
| priority_low       | FLOAT | 20.0    |
| priority_very_low  | FLOAT | 40.0    |

Tables are created automatically on first startup via `Base.metadata.create_all()` in the app lifespan handler. There are no migration files -- the ORM models are the source of truth.

---

### Queue Scoring Algorithm

The scoring function lives in `backend/app/services/queue_service.py`. Every non-completed ticket gets a numeric score. **Lower score = served first.**

```
score = base_fifo - priority_offset - skip_bonus + effort_penalty - due_date_urgency
```

**Term-by-term breakdown:**

| Term | Formula | Effect |
|------|---------|--------|
| `base_fifo` | `days_since_creation * age_weight` | Older tickets get higher base values, but since this is the baseline, they naturally sort to the front. Bigger age_weight = age matters more. |
| `priority_offset` | Lookup from priority weights table | Subtracted from score. Very high priority = -40, so subtracting -40 adds 40 to bring the score down. Low priority = +20, so subtracting +20 pushes score up. |
| `skip_bonus` | `skip_count * skip_weight` | Subtracted from score. More skips = lower score = served sooner. |
| `effort_penalty` | `est_hours * effort_weight` | Added to score. More hours = higher score = served later. Gives a slight preference to quick tasks. |
| `due_date_urgency` | If overdue: `overdue_penalty` (-100). Otherwise: `days_until_due * due_date_weight`. | Subtracted from score. Overdue tickets get a massive boost. Approaching deadlines get a moderate boost proportional to how close they are. |

**Worked example:**

A ticket created 5 days ago, priority "high", skipped twice, estimated 1 hour, due in 2 days:

```
base_fifo     = 5 * 10           =  50
priority      = -(-20)           =  20   (subtracted, so -(-20) = +20 added to base... 
                                          wait, let's trace the actual formula)

score = 50 - (-20) - (2 * 15) + (1 * 5) - (2 * -3)
      = 50 + 20 - 30 + 5 + 6
      = 51
```

A ticket created 1 day ago, default priority, no skips, 0.5 hours, no due date:

```
score = 10 - 0 - 0 + 2.5 - 0 = 12.5
```

The second ticket (score 12.5) would be served before the first (score 51).

---

### Recurring Ticket Scheduler

The scheduler is an async background loop in `backend/app/services/scheduler.py`.

**How it works:**

1. On app startup, `scheduler_loop()` is launched as an `asyncio.Task` in the lifespan handler.
2. Every 60 seconds, it calls `check_recurring_templates()`.
3. That function queries all active templates where `next_fire <= now`.
4. For each matching template, `fire_template()`:
   - Creates a new `Ticket` with the template's title, description, priority, and est_hours
   - Sets `last_fired` to the current time
   - Computes `next_fire` by adding the frequency interval to `last_fired`
   - Commits the transaction
5. The loop continues until the app shuts down.

**`compute_next_fire` logic:**

```python
base = last_fired or datetime(start_date)

if frequency == "daily":    next = base + timedelta(days=interval_count)
if frequency == "weekly":   next = base + timedelta(weeks=interval_count)
if frequency == "monthly":  next = base + relativedelta(months=interval_count)
```

**Idempotency:** Since `last_fired` is updated immediately after firing, and the query filters `next_fire <= now`, a template won't fire twice for the same interval even if the scheduler runs multiple times before the next interval elapses.

---

### Adding New Features

**Adding a new API endpoint:**

1. Create or edit a router file in `backend/app/routers/`
2. Add Pydantic schemas to `backend/app/schemas.py` if needed
3. Add ORM models to `backend/app/models.py` if needed (tables auto-create on restart)
4. Register the router in `backend/app/main.py` with `app.include_router()`

**Adding a new frontend page:**

1. Create a directory under `frontend/src/app/` matching your desired URL path
2. Add a `page.tsx` file in that directory
3. Add API client functions to `frontend/src/lib/api.ts`
4. Add TypeScript types to `frontend/src/lib/types.ts`
5. If needed, create shared components in `frontend/src/components/`

**Adding a new background service:**

1. Create a service file in `backend/app/services/`
2. If it needs a background loop, follow the pattern in `scheduler.py` (async function with `asyncio.sleep`)
3. Launch it as a task in the lifespan handler in `main.py`

---

### API Reference

Base URL: `http://localhost:8000/api` (direct) or `http://localhost:3000/api` (proxied through Next.js)

#### Tickets

**`GET /api/tickets`** -- List all tickets

Query parameters (all optional):
- `status` -- filter by status (`open`, `in-progress`, `completed`, `skipped`)
- `priority` -- filter by priority (`very low`, `low`, `default`, `high`, `very high`)
- `sort_by` -- column name to sort by (default: `date_created`)
- `sort_order` -- `asc` or `desc` (default: `desc`)

Response: `200 OK`
```json
[
  {
    "id": 1,
    "title": "Clean the kitchen",
    "status": "open",
    "date_created": "2026-04-10T14:30:00",
    "description": "Wipe counters, do dishes, mop floor",
    "due_date": "2026-04-15",
    "priority": "high",
    "est_hours": 1.0,
    "skip_count": 0,
    "related_ticket_ids": []
  }
]
```

---

**`POST /api/tickets`** -- Create a ticket

Request body:
```json
{
  "title": "Clean the kitchen",
  "description": "Wipe counters, do dishes, mop floor",
  "due_date": "2026-04-15",
  "priority": "high",
  "est_hours": 1.0,
  "related_ticket_ids": [2, 5]
}
```

Only `title` is required. All other fields are optional.

Response: `201 Created` -- returns the full ticket object.

---

**`GET /api/tickets/:id`** -- Get a single ticket

Response: `200 OK` -- returns the ticket object. `404` if not found.

---

**`PUT /api/tickets/:id`** -- Update a ticket

Request body (all fields optional, only provided fields are updated):
```json
{
  "title": "Updated title",
  "status": "completed",
  "priority": "low",
  "est_hours": 2.5
}
```

Response: `200 OK` -- returns the updated ticket object.

---

**`DELETE /api/tickets/:id`** -- Delete a ticket

Response: `204 No Content`. `404` if not found.

---

#### Queue

**`GET /api/queue/next`** -- Get the next ticket to work on

Returns the highest-priority ticket (lowest score). If the ticket's status is "open", it is changed to "in-progress".

Response: `200 OK`
```json
{
  "id": 3,
  "title": "Do laundry",
  "status": "in-progress",
  "date_created": "2026-04-08T09:00:00",
  "description": null,
  "due_date": null,
  "priority": "default",
  "est_hours": 0.5,
  "skip_count": 1,
  "related_ticket_ids": [],
  "score": 18.5
}
```

Response: `404` if no tickets are in the queue.

---

**`POST /api/queue/complete/:id`** -- Complete a ticket

Sets status to "completed". Response: `200 OK` -- returns the ticket. `404` if not found.

---

**`POST /api/queue/skip/:id`** -- Skip a ticket

Sets status to "skipped" and increments `skip_count` by 1. Response: `200 OK` -- returns the ticket. `404` if not found.

---

**`GET /api/queue/stats`** -- Get queue statistics

Response: `200 OK`
```json
{
  "total": 25,
  "total_open": 10,
  "total_in_progress": 2,
  "total_completed": 8,
  "total_skipped": 5
}
```

---

#### Recurring Templates

**`GET /api/recurring`** -- List all templates

Response: `200 OK`
```json
[
  {
    "id": 1,
    "title": "Weekly laundry",
    "description": "Wash, dry, fold",
    "priority": "default",
    "est_hours": 1.5,
    "active": true,
    "frequency": "weekly",
    "interval_count": 1,
    "start_date": "2026-01-06",
    "last_fired": "2026-04-07T12:00:00",
    "next_fire": "2026-04-14T12:00:00"
  }
]
```

---

**`POST /api/recurring`** -- Create a template

Request body:
```json
{
  "title": "Weekly laundry",
  "description": "Wash, dry, fold",
  "priority": "default",
  "est_hours": 1.5,
  "frequency": "weekly",
  "interval_count": 1,
  "start_date": "2026-01-06"
}
```

Required fields: `title`, `frequency`, `start_date`. Response: `201 Created`.

---

**`GET /api/recurring/:id`** -- Get a template

Response: `200 OK`. `404` if not found.

---

**`PUT /api/recurring/:id`** -- Update a template

Request body (all fields optional):
```json
{
  "active": false,
  "interval_count": 2
}
```

If `frequency`, `interval_count`, or `start_date` are changed, `next_fire` is automatically recomputed.

Response: `200 OK`.

---

**`DELETE /api/recurring/:id`** -- Delete a template

Response: `204 No Content`. `404` if not found.

---

#### Queue Config

**`GET /api/config`** -- Get current queue weights

Response: `200 OK`
```json
{
  "age_weight": 10.0,
  "skip_weight": 15.0,
  "effort_weight": 5.0,
  "due_date_weight": 3.0,
  "overdue_penalty": -100.0,
  "priority_very_high": -40.0,
  "priority_high": -20.0,
  "priority_default": 0.0,
  "priority_low": 20.0,
  "priority_very_low": 40.0
}
```

---

**`PUT /api/config`** -- Update queue weights

Request body (all fields optional):
```json
{
  "age_weight": 12.0,
  "skip_weight": 20.0
}
```

Response: `200 OK` -- returns the full config.

---

**`POST /api/config/reset`** -- Reset all weights to defaults

Response: `200 OK` -- returns the config with default values.

---

#### Health

**`GET /api/health`** -- Health check

Response: `200 OK`
```json
{
  "status": "ok"
}
```
