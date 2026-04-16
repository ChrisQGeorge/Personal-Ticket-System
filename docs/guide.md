# Personal Ticket System -- User and Developer Guide

---

## Part 1: User Guide

### Getting Started

**Prerequisites:** Docker, Docker Compose, and a bash shell (Git Bash on Windows).

1. Clone or download the project.
2. Open a terminal in the project root and run:

```bash
bash setup.sh
```

This generates a `.env` file with cryptographically random passwords, a JWT signing secret, and a Fernet encryption key. The app will not start without these.

3. Start the system:

```bash
docker-compose up -d --build
```

4. Wait 1-2 minutes on first launch for containers to build and MySQL to initialize.
5. Open [http://localhost:3000](http://localhost:3000) in your browser.
6. Register your first account. It automatically becomes the admin.

To stop: `docker-compose down`. Your data persists in a Docker volume (`pts_mysql_data`). To completely wipe data: `docker-compose down -v`.

**If you skip `setup.sh`**, the backend will refuse to start because `JWT_SECRET` and `ENCRYPTION_KEY` are not set. You can also create `.env` manually from `.env.template`, but `setup.sh` is the recommended approach.

---

### First Login

Click **Register** on the login page. Enter a username (3-100 characters) and a password that meets these requirements:

- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

The first registered user is automatically assigned the **admin** role. All subsequent users are regular users. After registration, you are logged in immediately.

---

### Creating Tickets

From the **Home** page, click **Create Ticket**. Fill in:

| Field | Required | Default | Description |
|---|---|---|---|
| Title | Yes | -- | Short summary (max 255 chars) |
| Description | No | -- | Detailed notes (max 50,000 chars) |
| Priority | No | `default` | very low, low, default, high, very high |
| Due Date | No | -- | Target completion date |
| Est Hours | No | -- | Time estimate (e.g., 0.5, 2, 8) |
| Related Tickets | No | -- | Link to other tickets for context |
| Profile | No | Default profile | Which profile this ticket belongs to |

Click **Save**. The ticket enters the queue as "open".

---

### Working the Queue

Navigate to **Queue** from the nav bar. The system presents the highest-priority ticket based on the scoring algorithm. You see the ticket's full details and its computed score.

Two actions:

- **Complete** -- marks the ticket as "completed", removes it from the queue, loads the next ticket.
- **Skip** -- increments the ticket's skip count by 1, marks it "skipped", loads the next ticket. The skipped ticket stays in the queue but its position shifts.

When all tickets are done, the page shows an empty-state message.

You can filter the queue by profile using the profile selector.

**How queue order works (plain English):**

Every non-completed ticket gets a numeric score. Lower score = served first. The factors:

- **Older tickets** naturally surface first (FIFO baseline).
- **Higher priority** tickets get a score boost that moves them up.
- **Approaching deadlines** push tickets up. Overdue tickets jump to the top with a large penalty.
- **Frequently skipped** tickets gradually bubble up so you cannot avoid them forever.
- **Lower effort** tickets get a slight edge, favoring quick wins.

All of these weights are tunable by an admin in Queue Settings.

---

### Managing Tickets

The **Tickets** page shows all your tickets in a sortable table (desktop) or card list (mobile).

**Filtering:** Use the status and priority dropdowns to narrow the list.

**Sorting:** Click any column header to sort. Click again to reverse.

**Editing:** Click a ticket to open its edit form. Change any field and save. You can reopen a completed ticket by changing its status back to "open". Delete a ticket with the Delete button.

---

### Profiles

Profiles let you maintain completely separate ticket lists. For example, you might have a "Personal" profile and a "Work" profile.

**Creating a profile:**

1. Go to **Profiles** from the nav bar.
2. Click **New Profile**.
3. Enter a name and pick a color.

**Switching profiles:** The home page shows all your profiles as colored pills. Click one to filter the dashboard and queue to that profile. Click "All" to see everything.

**Deleting a profile:** A profile can only be deleted if it has no tickets or recurring templates. Reassign them to another profile first.

Each user gets a default profile on registration.

---

### Recurring Tickets

Recurring tickets auto-create new tickets on a schedule.

**Creating a template:**

1. Go to **Recurring** from the nav bar.
2. Click **Create Recurring Ticket**.
3. Fill in:

| Field | Description |
|---|---|
| Title | Title for generated tickets |
| Description | Description copied to each ticket |
| Priority | Priority for generated tickets |
| Est Hours | Time estimate for generated tickets |
| Due In Days | Relative due date -- e.g., 7 means the ticket is due 7 days after creation |
| Frequency | `daily`, `weekly`, or `monthly` |
| Interval Count | Units between fires (e.g., 2 with weekly = every 2 weeks) |
| Start Date | When the schedule begins |
| Active | Toggle on/off without deleting |
| Profile | Which profile tickets are created in |

**Schedule behavior:**

The backend checks all active templates every 60 seconds. When `next_fire <= now`, it:

1. Creates a new ticket with the template's fields.
2. If `due_in_days` is set, the ticket's due date = creation date + that many days.
3. Records `last_fired` and computes the next fire date.

**Examples:**
- Weekly, interval 1, start Jan 6 -- fires every week from Jan 6.
- Monthly, interval 2, start Mar 15 -- fires on the 15th every 2 months.
- Daily, interval 3 -- fires every 3 days.

Toggle **Active** off to pause without deleting. Deleting a template does not remove tickets it already created.

---

### Email-to-Ticket

Each profile can be configured with IMAP credentials to automatically create tickets from incoming emails.

**Setup:**

1. Go to **Profiles** and edit the profile you want to enable email for.
2. Fill in the IMAP fields:
   - **IMAP Host**: e.g., `imap.gmail.com`
   - **IMAP Port**: 993 (default, SSL) or 143 (non-SSL)
   - **IMAP User**: your email address
   - **IMAP Password**: your email password or app-specific password
   - **Use SSL**: on (recommended)
3. Toggle **Email Enabled** on.
4. Click **Test Connection** to verify.
5. Save.

**Gmail App Passwords:** Gmail requires an App Password if you have 2-factor authentication enabled. Go to Google Account > Security > 2-Step Verification > App passwords, generate one, and use it as the IMAP password.

**How it works:**

Every 60 seconds, the scheduler checks all email-enabled profiles. For each unread email in the INBOX:

- Email subject becomes the ticket title (truncated to 255 chars).
- Email body becomes the description (HTML tags and images stripped).
- The ticket is created in the profile's ticket list.
- The email is marked as read.

IMAP passwords are encrypted with Fernet before storage. They are never included in backups.

**SSRF protection:** The system blocks IMAP connections to localhost, private IPs, and Docker-internal hostnames.

---

### Importing Tickets

Go to the **Import** page to bulk-create tickets from a file.

**Supported formats:** CSV (.csv) and Excel (.xlsx).

**Steps:**

1. Optionally download the template (click **Download Template**) to see the expected columns.
2. Prepare your file with columns: Title, Description, Priority, Due Date, Est Hours, Status.
3. Select a profile to import into (or leave as default).
4. Upload the file.

**Limits:** 10MB file size, 5000 rows maximum.

**Column mapping:** Headers are matched case-insensitively. "Due Date" and "due_date" both work. Unknown columns are ignored. Only Title is required.

**CSV injection prevention:** Cell values starting with `=`, `+`, `-`, `@`, tab, or newline characters have those prefixes stripped.

---

### Backup & Restore

Go to the **Backup** page.

**Download Backup:** Creates a JSON file containing all your profiles, tickets, recurring templates, ticket relationships, and queue config. Admin users get all users' data; regular users get only their own.

IMAP passwords are always stripped from backups.

**Restore:** Upload a previously downloaded backup JSON file. This replaces all your current data (profiles, tickets, templates) with the backup contents. Ticket IDs are remapped. After restoring, re-enter any IMAP passwords.

---

### Account Management

Go to the **Account** page (accessible from the nav bar) to change your password. Enter your current password and a new password meeting the password policy.

Changing your password invalidates all other active sessions (token versioning).

---

### Admin Features

Admin users have access to additional pages:

**User Management** (Admin > Users):
- View all registered users with their roles and active status.
- Change a user's role between admin and user.
- Activate or deactivate accounts. Deactivation immediately invalidates all the user's sessions.
- Delete user accounts.
- You cannot change your own role or deactivate/delete yourself.

**Queue Weight Configuration** (Config):
- Adjust the scoring algorithm weights. See the "Queue Scoring Algorithm" section in the Developer Guide for details on each parameter.
- Click **Reset to Defaults** to restore factory settings.

Admins cannot see other users' tickets. Data isolation is enforced at the query level.

---

## Part 2: Developer Guide

### Architecture Overview

The system runs as three Docker containers on a bridge network (`pts_network`):

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│    Frontend      │     │     Backend       │     │    Database     │
│  (pts_frontend)  │────>│   (pts_backend)   │────>│    (pts_db)     │
│  Next.js :3000   │     │  FastAPI :8000    │     │  MySQL :3306    │
└─────────────────┘     └──────────────────┘     └────────────────┘
```

- **Frontend** proxies `/api/*` requests to the backend via Next.js rewrites (configured in `next.config.js`). The browser only talks to port 3000.
- **Backend** connects to MySQL over the internal Docker network (`db:3306`). Exposed on `127.0.0.1:9999` for testing.
- **Database** uses a Docker volume (`pts_mysql_data`) for persistence. A `db-init/01-grant-access.sql` script runs on first init to grant least-privilege access.

All containers use `restart: unless-stopped`. The backend waits for the DB health check before starting.

---

### Backend Structure

```
backend/app/
├── main.py          # App setup: lifespan (migrations, scheduler), CORS, security headers, routers
├── database.py      # SQLAlchemy engine, SessionLocal, get_db dependency
├── models.py        # ORM models + enums (User, Profile, Ticket, RecurringTemplate, QueueConfig)
├── schemas.py       # Pydantic models for request/response validation
├── auth.py          # Password hashing (Argon2id), JWT creation/validation, Fernet encryption, auth dependencies
├── routers/
│   ├── auth.py      # Login, register, logout, change-password, rate limiting
│   ├── admin.py     # User management (list, role change, activate/deactivate, delete)
│   ├── tickets.py   # Ticket CRUD with ownership verification
│   ├── queue.py     # Next ticket, complete, skip, stats
│   ├── recurring.py # Recurring template CRUD
│   ├── config.py    # Queue weight config (admin only)
│   ├── imports.py   # CSV/Excel import + template download
│   ├── profiles.py  # Profile CRUD, IMAP config, test-email
│   └── backup.py    # JSON backup download + restore
└── services/
    ├── queue_service.py  # Scoring algorithm: compute_score(), get_next_ticket()
    ├── scheduler.py      # Background loop: recurring templates + email polling (60s interval)
    └── email_service.py  # IMAP connection, email parsing, ticket creation, SSRF checks
```

**Key patterns:**
- All routers use `APIRouter` with prefix and tags, registered in `main.py` under `/api`.
- Database sessions injected via `Depends(get_db)`.
- Authentication via `Depends(get_current_user)` (reads JWT from cookie). Admin routes use `Depends(require_admin)`.
- Ownership verification: every data-access route joins through `Profile` to check `user_id` matches the authenticated user.
- Lifespan handler runs lightweight migrations (adds columns if missing), seeds default config, and starts the async scheduler.

---

### Frontend Structure

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout, Navbar, global CSS
│   ├── page.tsx                # Home: profile switcher, stats, quick actions
│   ├── queue/page.tsx          # Queue workflow (complete/skip)
│   ├── tickets/
│   │   ├── page.tsx            # Ticket list with filters and sorting
│   │   ├── new/page.tsx        # Create ticket
│   │   └── [id]/page.tsx       # Edit ticket
│   ├── recurring/
│   │   ├── page.tsx            # Template list
│   │   ├── new/page.tsx        # Create template
│   │   └── [id]/page.tsx       # Edit template
│   ├── profiles/
│   │   ├── page.tsx            # Profile list
│   │   ├── new/page.tsx        # Create profile
│   │   └── [id]/page.tsx       # Edit profile + IMAP config
│   ├── config/page.tsx         # Queue weight settings (admin)
│   ├── import/page.tsx         # CSV/Excel import
│   ├── backup/page.tsx         # Backup download + restore
│   ├── admin/users/page.tsx    # User management (admin)
│   └── account/page.tsx        # Password change
├── components/
│   ├── Navbar.tsx              # Navigation, responsive mobile menu
│   ├── AuthGate.tsx            # Authentication wrapper, redirects to login
│   ├── TicketForm.tsx          # Shared create/edit ticket form
│   └── RecurringForm.tsx       # Shared create/edit template form
└── lib/
    ├── api.ts                  # Typed fetch wrapper with credentials: "include"
    └── types.ts                # TypeScript interfaces matching backend schemas
```

**Key patterns:**
- Next.js App Router (directory-based routing).
- `AuthGate` wraps authenticated pages and redirects to login if no session.
- `api.ts` sends all requests with `credentials: "include"` so the httpOnly cookie is attached.
- API base URL is empty in production (requests proxy through Next.js rewrites).

---

### Database Schema

#### `users`

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK, auto-increment |
| username | VARCHAR(100) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(512) | NOT NULL (Argon2id) |
| role | ENUM('admin','user') | NOT NULL, default 'user' |
| is_active | BOOLEAN | NOT NULL, default true |
| created_at | DATETIME | NOT NULL, default now() |
| token_version | INT | NOT NULL, default 0 |

#### `profiles`

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK, auto-increment |
| name | VARCHAR(100) | NOT NULL |
| color | VARCHAR(7) | NOT NULL, default '#6366f1' |
| user_id | INT | FK -> users.id |
| imap_host | VARCHAR(255) | Nullable |
| imap_port | INT | Nullable, default 993 |
| imap_user | VARCHAR(255) | Nullable |
| imap_password | VARCHAR(512) | Nullable (Fernet encrypted) |
| imap_use_ssl | BOOLEAN | NOT NULL, default true |
| email_enabled | BOOLEAN | NOT NULL, default false |

#### `tickets`

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK, auto-increment |
| title | VARCHAR(255) | NOT NULL |
| status | ENUM | 'open', 'in-progress', 'completed', 'skipped'. Default 'open'. |
| date_created | DATETIME | NOT NULL, default now() |
| description | TEXT | Nullable |
| due_date | DATE | Nullable |
| priority | ENUM | 'very low', 'low', 'default', 'high', 'very high'. Default 'default'. |
| est_hours | FLOAT | Nullable |
| skip_count | INT | NOT NULL, default 0 |
| profile_id | INT | FK -> profiles.id |

#### `ticket_relationships` (many-to-many self-join)

| Column | Type | Constraints |
|---|---|---|
| source_ticket_id | INT | PK, FK -> tickets.id, CASCADE |
| related_ticket_id | INT | PK, FK -> tickets.id, CASCADE |

#### `recurring_templates`

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK, auto-increment |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | Nullable |
| priority | ENUM | Same as tickets |
| est_hours | FLOAT | Nullable |
| active | BOOLEAN | NOT NULL, default true |
| frequency | ENUM | 'daily', 'weekly', 'monthly' |
| interval_count | INT | NOT NULL, default 1 |
| start_date | DATE | NOT NULL |
| last_fired | DATETIME | Nullable |
| next_fire | DATETIME | Nullable |
| profile_id | INT | FK -> profiles.id |
| due_in_days | INT | Nullable |

#### `queue_config` (singleton, always id=1)

| Column | Type | Default |
|---|---|---|
| id | INT | 1 |
| age_weight | FLOAT | 10.0 |
| skip_weight | FLOAT | 15.0 |
| effort_weight | FLOAT | 5.0 |
| due_date_weight | FLOAT | 3.0 |
| overdue_penalty | FLOAT | -100.0 |
| priority_very_high | FLOAT | -40.0 |
| priority_high | FLOAT | -20.0 |
| priority_default | FLOAT | 0.0 |
| priority_low | FLOAT | 20.0 |
| priority_very_low | FLOAT | 40.0 |

Tables are created via `Base.metadata.create_all()` on startup. Lightweight column migrations run in the lifespan handler for schema changes added after initial release.

---

### Authentication Flow

1. **Registration:** Username + password submitted to `POST /api/auth/register`. Password is validated against the policy (Pydantic validator), hashed with Argon2id, and stored. A default profile is created. A JWT is issued in an httpOnly cookie with `SameSite=Lax`.

2. **Login:** Username + password submitted to `POST /api/auth/login`. Rate limited: 5 attempts per username per 5 minutes, 20 per IP per 5 minutes. On failed login for a non-existent user, a dummy hash is computed to prevent timing-based username enumeration. On success, JWT is set as an httpOnly cookie.

3. **JWT structure:**
   ```json
   {
     "sub": "user_id",
     "role": "admin|user",
     "ver": 0,
     "exp": "...",
     "iat": "..."
   }
   ```

4. **Token validation:** The `get_current_user` dependency extracts the JWT from the `access_token` cookie, verifies the signature, checks expiry, confirms the user exists and is active, and checks `ver` matches the user's `token_version`.

5. **Token versioning:** When a user changes their password or an admin deactivates their account, `token_version` is incremented. All existing tokens with the old version are immediately invalid.

6. **Encryption:** IMAP passwords are encrypted with Fernet (symmetric, using `ENCRYPTION_KEY`) before database storage. The key must be preserved across server migrations or passwords must be re-entered.

---

### Queue Scoring Algorithm

Located in `backend/app/services/queue_service.py`. Every non-completed ticket gets a numeric score. **Lower score = served first.**

**Formula:**

```
score = (days_since_creation * age_weight)
      - priority_offset
      - (skip_count * skip_weight)
      + (est_hours * effort_weight)
      - due_date_urgency
```

**Term breakdown:**

| Term | Formula | Effect |
|---|---|---|
| Age | `days_since_creation * age_weight` | Older tickets get higher base scores. Since the score starts high and other terms subtract from it, older tickets naturally sort first. Default: 10 points per day. |
| Priority offset | Lookup from config | Subtracted from score. Very high = -40 (subtracting -40 = +40 added), so high-priority tickets get lower scores. Very low = +40 (subtracting +40 = -40), so low-priority tickets sink. |
| Skip bonus | `skip_count * skip_weight` | Subtracted from score. More skips = lower score = served sooner. Default: 15 per skip. |
| Effort penalty | `est_hours * effort_weight` | Added to score. More hours = higher score = served later. Gives a slight preference to quick tasks. Default: 5 per hour. |
| Due date urgency | If overdue: `overdue_penalty` (default -100). Otherwise: `days_until_due * -due_date_weight`. | Subtracted from score. Overdue tickets get a massive boost. Approaching deadlines get a proportional boost. |

**Worked example:**

Ticket A: 5 days old, "high" priority, skipped twice, 1 hour estimate, due in 2 days.

```
score = (5 * 10) - (-20) - (2 * 15) + (1 * 5) - (2 * -3)
      = 50 + 20 - 30 + 5 + 6
      = 51
```

Ticket B: 1 day old, "default" priority, no skips, 0.5 hours, no due date.

```
score = (1 * 10) - 0 - 0 + (0.5 * 5) - 0
      = 10 + 2.5
      = 12.5
```

Ticket B (12.5) is served before Ticket A (51).

---

### Recurring Ticket Scheduler

Located in `backend/app/services/scheduler.py`. An async background loop launched during app lifespan.

**Cycle (every 60 seconds):**

1. `check_recurring_templates()`: queries active templates where `next_fire <= now`.
2. For each match, `fire_template()`:
   - Creates a `Ticket` with the template's title, description, priority, est_hours, and profile_id.
   - If `due_in_days` is set, sets `due_date = today + due_in_days`.
   - Sets `last_fired = now`, computes `next_fire = last_fired + interval`.
3. `check_all_email_profiles()`: polls IMAP for all email-enabled profiles.

**`compute_next_fire` logic:**

```python
base = last_fired or datetime(start_date)

if frequency == "daily":    next = base + timedelta(days=interval_count)
if frequency == "weekly":   next = base + timedelta(weeks=interval_count)
if frequency == "monthly":  next = base + relativedelta(months=interval_count)
```

**Idempotency:** `last_fired` is updated immediately after firing. The query filters `next_fire <= now`, so a template will not fire twice for the same interval.

---

### Email Polling Service

Located in `backend/app/services/email_service.py`. Called by the scheduler every 60 seconds.

**Flow per profile:**

1. Check that the profile has email enabled and IMAP credentials configured.
2. Validate the IMAP host is safe (not internal/private -- SSRF protection).
3. Decrypt the stored IMAP password using Fernet.
4. Connect via IMAP4_SSL (or IMAP4 if SSL disabled).
5. Search for `UNSEEN` messages in INBOX.
6. For each unread email:
   - Decode the subject (handles encoded headers) -- becomes ticket title.
   - Extract the body: prefer plaintext, fall back to HTML with tag stripping.
   - Create a ticket in the profile.
   - Mark the email as `\Seen`.
7. Log out and close connection.

**SSRF protection (`_is_safe_host`):**
- Blocks known internal hostnames: localhost, 127.0.0.1, ::1, Docker service names.
- Blocks `.internal` and `.local` TLDs.
- Resolves the hostname and checks if any resulting IP is private, loopback, reserved, or link-local.

---

### Security Architecture

**Authentication layer:**
- Argon2id with time_cost=3, memory_cost=64MB, parallelism=4, hash_len=32, salt_len=16.
- JWT with HS256, configurable expiry (default 24h), stored in httpOnly cookie with SameSite=Lax.
- Token versioning: `users.token_version` is checked on every request. Incremented on password change and account deactivation.

**Rate limiting:**
- Login: 5 per username per 5 minutes + 20 per IP per 5 minutes. In-memory with thread-safe dictionaries.
- Registration: shares the per-IP limit.
- IMAP test: 3 per profile per minute.

**Input validation:**
- Pydantic schemas enforce types, lengths, and required fields.
- HTML tags stripped from ticket title and description (`re.sub(r'<[^>]+>', '', text)`).
- Sort fields validated against a whitelist: `{id, title, status, priority, due_date, est_hours, date_created, skip_count}`.
- Priority and status values validated against enum sets.
- File upload size limits enforced before processing.
- CSV injection: formula prefix characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`) stripped from imported cell values.

**Security headers (middleware):**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Server: PTS` (masked)

**CORS:**
- Origins configured via `ALLOWED_ORIGINS` env var (comma-separated).
- Methods limited to GET, POST, PUT, DELETE.
- Headers limited to Content-Type.
- Credentials allowed.

**Data isolation:**
- Every query that returns user data joins through `Profile` and filters on `Profile.user_id == current_user.id`.
- Admins have access to user management and queue config but cannot see other users' tickets.
- Ownership is verified on every read, update, and delete operation.

**Database security:**
- Application user (`pts_user`) granted only: SELECT, INSERT, UPDATE, DELETE, ALTER, CREATE, INDEX.
- Root password restricted to localhost connections (`MYSQL_ROOT_HOST: "localhost"`).
- Database port bound to `127.0.0.1:3306` (not exposed externally).
- Backend port bound to `127.0.0.1:9999`.

**Secrets:**
- All secrets in `.env` with `chmod 600`.
- `setup.sh` generates 32-character alphanumeric passwords, URL-safe JWT secret (48 bytes), and Fernet key.
- App startup validates that `JWT_SECRET` and `ENCRYPTION_KEY` are set and not placeholder values.

---

### Adding New Features

**Adding a new API endpoint:**

1. Create or edit a router in `backend/app/routers/`.
2. Add Pydantic schemas to `backend/app/schemas.py`.
3. Add ORM models to `backend/app/models.py` if needed (tables auto-create on restart).
4. Register the router in `backend/app/main.py`: `app.include_router(my_router.router, prefix="/api")`.
5. Add `get_current_user` or `require_admin` as a dependency for auth.
6. Use `_verify_*_ownership()` patterns for data isolation.

**Adding a new frontend page:**

1. Create a directory under `frontend/src/app/` matching your URL path.
2. Add a `page.tsx` file.
3. Add API client functions to `frontend/src/lib/api.ts`.
4. Add TypeScript types to `frontend/src/lib/types.ts`.
5. Wrap authenticated content with `AuthGate`.
6. Add a nav link in `frontend/src/components/Navbar.tsx`.

**Adding a new background service:**

1. Create a service in `backend/app/services/`.
2. For periodic tasks, add a call in the `scheduler_loop()` function in `scheduler.py` (runs every 60 seconds).
3. For independent loops, launch as an `asyncio.Task` in the lifespan handler in `main.py`.

---

### Running Tests

The test suite has 56 tests across 4 files:

| File | Coverage |
|---|---|
| `test_auth.py` | Registration, login, logout, password change, password policy, auto-admin |
| `test_authorization.py` | RBAC, data isolation between users, IDOR prevention, admin-only routes |
| `test_security.py` | Security headers, CORS, cookie attributes (httpOnly, SameSite), rate limiting |
| `test_input_validation.py` | HTML stripping, enum validation, sort field whitelist, edge cases |

**Running:**

```bash
# Ensure the stack is running
docker-compose up -d --build

# Install test dependencies
pip install pytest requests

# Run all tests
pytest tests/ -v

# Run a specific file
pytest tests/test_security.py -v
```

Tests run against `http://127.0.0.1:9999` (the backend's exposed port). Override with `PTS_TEST_URL` environment variable.

The test fixtures in `conftest.py` automatically register an admin and a regular user. On fresh databases, the first registration becomes admin. For existing databases, set `PTS_ADMIN_USER` and `PTS_ADMIN_PASS`.

---

### Full API Reference

Base URL: `http://localhost:3000/api` (proxied) or `http://127.0.0.1:9999/api` (direct).

---

#### Auth

**`POST /api/auth/register`** -- Register a new user

Request:
```json
{
  "username": "alice",
  "password": "MyP@ssw0rd!"
}
```

Response `200`:
```json
{
  "message": "Registration successful",
  "user": {
    "id": 1,
    "username": "alice",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-04-16T12:00:00"
  }
}
```

Sets `access_token` httpOnly cookie. First user gets role "admin", subsequent users get "user". Rate limited.

---

**`POST /api/auth/login`** -- Log in

Request:
```json
{
  "username": "alice",
  "password": "MyP@ssw0rd!"
}
```

Response `200`:
```json
{
  "message": "Login successful",
  "user": { "id": 1, "username": "alice", "role": "admin", "is_active": true, "created_at": "..." }
}
```

`401` on invalid credentials. `403` if account is disabled. `429` if rate limited.

---

**`POST /api/auth/logout`** -- Log out

Clears the `access_token` cookie.

Response `200`: `{"message": "Logged out"}`

---

**`GET /api/auth/me`** -- Get current user

Response `200`:
```json
{
  "id": 1,
  "username": "alice",
  "role": "admin",
  "is_active": true,
  "created_at": "2026-04-16T12:00:00"
}
```

`401` if not authenticated.

---

**`POST /api/auth/change-password`** -- Change password

Request:
```json
{
  "current_password": "MyP@ssw0rd!",
  "new_password": "NewP@ss1!"
}
```

Response `200`: `{"message": "Password changed successfully"}`

Increments `token_version`, invalidating all other sessions. Issues a new cookie.

---

#### Tickets

**`GET /api/tickets`** -- List tickets

Query parameters (all optional):
- `status`: `open`, `in-progress`, `completed`, `skipped`
- `priority`: `very low`, `low`, `default`, `high`, `very high`
- `profile_id`: filter by profile
- `sort_by`: `id`, `title`, `status`, `priority`, `due_date`, `est_hours`, `date_created`, `skip_count` (default: `date_created`)
- `sort_order`: `asc` or `desc` (default: `desc`)

Response `200`:
```json
[
  {
    "id": 1,
    "title": "Fix login bug",
    "status": "open",
    "date_created": "2026-04-10T14:30:00",
    "description": "Users get 500 on login",
    "due_date": "2026-04-15",
    "priority": "high",
    "est_hours": 2.0,
    "skip_count": 0,
    "related_ticket_ids": [3],
    "profile_id": 1
  }
]
```

---

**`POST /api/tickets`** -- Create a ticket

Request:
```json
{
  "title": "Fix login bug",
  "description": "Users get 500 on login",
  "due_date": "2026-04-15",
  "priority": "high",
  "est_hours": 2.0,
  "related_ticket_ids": [3],
  "profile_id": 1
}
```

Only `title` is required. Response `201`: the created ticket object.

---

**`GET /api/tickets/{id}`** -- Get a ticket

Response `200`: ticket object. `404` if not found or not owned by current user.

---

**`PUT /api/tickets/{id}`** -- Update a ticket

Request (all fields optional):
```json
{
  "title": "Updated title",
  "status": "completed",
  "priority": "low",
  "est_hours": 3.0
}
```

Response `200`: updated ticket object.

---

**`DELETE /api/tickets/{id}`** -- Delete a ticket

Response `204 No Content`. `404` if not found.

---

#### Queue

**`GET /api/queue/next`** -- Get next ticket in queue

Query: `profile_id` (optional).

Returns the ticket with the lowest score. If status is "open", it is changed to "in-progress".

Response `200`:
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
  "profile_id": 1,
  "score": 18.5
}
```

`404` if no tickets in queue.

---

**`POST /api/queue/complete/{id}`** -- Complete a ticket

Sets status to "completed". Response `200`: the ticket.

---

**`POST /api/queue/skip/{id}`** -- Skip a ticket

Sets status to "skipped", increments `skip_count`. Response `200`: the ticket.

---

**`GET /api/queue/stats`** -- Get ticket counts

Query: `profile_id` (optional).

Response `200`:
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

**`GET /api/recurring`** -- List templates

Query: `profile_id` (optional).

Response `200`:
```json
[
  {
    "id": 1,
    "title": "Weekly laundry",
    "description": "Wash, dry, fold",
    "priority": "default",
    "est_hours": 1.5,
    "due_in_days": 7,
    "active": true,
    "frequency": "weekly",
    "interval_count": 1,
    "start_date": "2026-01-06",
    "last_fired": "2026-04-07T12:00:00",
    "next_fire": "2026-04-14T12:00:00",
    "profile_id": 1
  }
]
```

---

**`POST /api/recurring`** -- Create a template

Request:
```json
{
  "title": "Weekly laundry",
  "description": "Wash, dry, fold",
  "priority": "default",
  "est_hours": 1.5,
  "due_in_days": 7,
  "frequency": "weekly",
  "interval_count": 1,
  "start_date": "2026-01-06",
  "profile_id": 1
}
```

Required: `title`, `frequency`, `start_date`. Response `201`.

---

**`GET /api/recurring/{id}`** -- Get a template

Response `200`. `404` if not found.

---

**`PUT /api/recurring/{id}`** -- Update a template

Request (all fields optional):
```json
{
  "active": false,
  "interval_count": 2,
  "due_in_days": 14
}
```

If `frequency`, `interval_count`, or `start_date` change, `next_fire` is recomputed.

Response `200`.

---

**`DELETE /api/recurring/{id}`** -- Delete a template

Response `204`. Does not delete tickets already created by the template.

---

#### Profiles

**`GET /api/profiles`** -- List user's profiles

Response `200`:
```json
[
  {
    "id": 1,
    "name": "Personal",
    "color": "#6366f1",
    "user_id": 1,
    "imap_host": "imap.gmail.com",
    "imap_port": 993,
    "imap_user": "alice@gmail.com",
    "imap_use_ssl": true,
    "email_enabled": true,
    "has_password": true
  }
]
```

Note: `imap_password` is never returned. `has_password` indicates whether one is set.

---

**`POST /api/profiles`** -- Create a profile

Request:
```json
{
  "name": "Work",
  "color": "#ef4444"
}
```

Response `201`. `409` if name already exists for this user.

---

**`GET /api/profiles/{id}`** -- Get a profile

Response `200`. `404` if not found or not owned.

---

**`PUT /api/profiles/{id}`** -- Update a profile

Request (all fields optional):
```json
{
  "name": "Work Projects",
  "color": "#3b82f6",
  "imap_host": "imap.gmail.com",
  "imap_port": 993,
  "imap_user": "alice@gmail.com",
  "imap_password": "my-app-password",
  "imap_use_ssl": true,
  "email_enabled": true
}
```

`imap_password` is encrypted with Fernet before storage. IMAP host is validated against SSRF.

Response `200`.

---

**`DELETE /api/profiles/{id}`** -- Delete a profile

Response `204`. `409` if the profile has tickets or templates (reassign them first).

---

**`POST /api/profiles/{id}/test-email`** -- Test IMAP connection

Response `200`:
```json
{ "success": true, "message": "IMAP connection successful." }
```

Or on failure:
```json
{ "success": false, "message": "IMAP authentication failed. Check your credentials." }
```

Rate limited: 3 attempts per minute per profile.

---

#### Import/Export

**`POST /api/import`** -- Import tickets from CSV/Excel

Multipart form data:
- `file`: CSV or XLSX file (max 10MB, 5000 rows)
- `profile_id` (optional): target profile

Response `200`:
```json
{
  "imported": 42,
  "errors": [
    { "row": 15, "error": "Invalid priority value" }
  ]
}
```

---

**`GET /api/import/template`** -- Download import template

Returns an XLSX file with headers and an example row.

---

#### Backup

**`POST /api/backup`** -- Download backup

Returns a JSON file download. Admin gets all users' data; regular users get their own.

Response headers: `Content-Disposition: attachment; filename=pts_backup_20260416_120000.json`

---

**`POST /api/backup/restore`** -- Restore from backup

Multipart form: `file` (JSON, max 50MB).

Response `200`:
```json
{
  "restored": true,
  "profiles": 2,
  "tickets": 45,
  "recurring_templates": 5,
  "ticket_relationships": 10
}
```

Replaces all current user data with backup contents. Admin also restores queue config.

---

#### Config (Admin Only)

**`GET /api/config`** -- Get queue weights

Response `200`:
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

Request (all fields optional):
```json
{
  "age_weight": 12.0,
  "skip_weight": 20.0
}
```

Response `200`: full config object.

---

**`POST /api/config/reset`** -- Reset to defaults

Response `200`: config with default values.

---

#### Admin (Admin Only)

**`GET /api/admin/users`** -- List all users

Response `200`:
```json
[
  { "id": 1, "username": "alice", "role": "admin", "is_active": true, "created_at": "..." },
  { "id": 2, "username": "bob", "role": "user", "is_active": true, "created_at": "..." }
]
```

---

**`PUT /api/admin/users/{id}/role`** -- Change user role

Request: `{"role": "admin"}` or `{"role": "user"}`

Response `200`: user object. `400` if changing own role.

---

**`PUT /api/admin/users/{id}/active`** -- Activate/deactivate user

Request: `{"is_active": false}`

Increments `token_version` to invalidate all the user's sessions.

Response `200`: user object. `400` if targeting yourself.

---

**`DELETE /api/admin/users/{id}`** -- Delete user

Response `200`: `{"message": "User deleted"}`. `400` if deleting yourself.

---

#### Health

**`GET /api/health`**

Response `200`: `{"status": "ok"}`
