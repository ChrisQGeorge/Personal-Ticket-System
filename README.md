# Personal Ticket System (PTS)

A self-hosted task management app with a weighted FIFO queue that decides what you should work on next, eliminating decision fatigue.

## Features

**Queue-Driven Workflow**
- Weighted scoring algorithm considers age, priority, due date urgency, skip count, and effort
- Complete or skip tickets -- the next one loads automatically
- Skipping resets a ticket's effective age and adds a skip penalty, pushing it to the back of the queue
- Admin-configurable scoring weights with reset-to-defaults

**Ticket Management**
- Full CRUD with priority, due dates, time estimates, and related tickets
- Filterable by status/priority, sortable columns
- Mobile-responsive (cards on mobile, table on desktop)

**Profiles**
- Multiple independent profiles per user (e.g., Personal, Work)
- Each profile has its own ticket list, color label, and optional IMAP config
- Profile switcher on the home page

**Recurring Tickets**
- Template-based: daily, weekly, or monthly with custom intervals
- Relative due dates (e.g., "due 7 days after creation")
- Background scheduler fires every 60 seconds

**Email-to-Ticket**
- IMAP polling per profile -- unread emails become tickets
- HTML/image stripping, subject becomes title, body becomes description
- SSRF protection blocks internal/private IP targets

**Import/Export**
- CSV and Excel (.xlsx) import with downloadable template
- CSV injection prevention, 10MB / 5000-row limits

**Backup & Restore**
- Full JSON backup/restore for server migration
- User-scoped (admin gets all data), IMAP passwords stripped from exports

**Gamification -- "Task Quest"**
- Opt-in per user from the Account page or /gamification dashboard
- XP system: earn 50-250 XP for completing tickets (scaled by priority), 25+ XP for creating tickets, lose 50 XP for skipping
- Effort, streak, and combo multipliers stack on completion XP
- 100 levels across 10 rank titles: Apprentice, Journeyman, Expert, Master, Grandmaster, Myth-Seeker, Legend, Titan, Immortal, Ascended One
- Streaks: complete 1+ ticket daily; bonuses at 3/7/14/30 days; streak shield unlocks at 30 days
- Combo system: completing without skipping builds multiplier (1.2x at 3, 1.4x at 5, 1.75x at 10); skipping resets combo
- 22 achievements from "Ticket Writer" (create first ticket) to "Mythical Streak" (100-day streak)
- 3 daily challenges and 1 weekly challenge, randomly selected
- Gamification dashboard at /gamification with XP progress, achievements, and challenge cards
- XP toast notifications on complete/skip/create
- Level badge displayed in the navbar when enabled
- Gamification summary card on the home page

**Chrome Extension**
- Create tickets and work the queue from any browser tab
- Manifest V3, vanilla JS, no build step required
- Two tabs: Create Ticket and Queue (complete/skip)
- Configurable server URL stored in Chrome sync storage
- Login via same cookie-based authentication
- Profile selector for both create and queue views
- Gamification bar showing level, XP, streak, and combo
- Game event notifications inline (XP gains/losses, level ups, achievements)
- Downloadable as zip from the Account page

**Authentication & Security**
- User accounts with Argon2id hashing, JWT in httpOnly cookies
- First registered user becomes admin
- Role-based access, complete data isolation between users
- Rate limiting, security headers, CORS lockdown, input sanitization
- Token versioning -- password changes and deactivation invalidate all sessions

## Tech Stack

| Layer    | Technology                                |
|----------|-------------------------------------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS      |
| Backend  | FastAPI, SQLAlchemy, Pydantic             |
| Database | MySQL 8.0                                 |
| Auth     | Argon2id + JWT + Fernet encryption        |
| Infra    | Docker Compose (3 containers)             |

## Quick Start

**Prerequisites:** Docker, Docker Compose, and a bash shell (Git Bash on Windows).

```bash
git clone <repo-url>
cd Personal-Ticket-System

# REQUIRED: generate .env with secure random secrets
bash setup.sh

# Start all containers
docker-compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000) and register your first account. The first user automatically becomes admin.

First startup takes 1-2 minutes while containers build and MySQL initializes. Subsequent starts are fast.

**`setup.sh` must be run before first launch.** It generates the `.env` file with cryptographically random passwords, JWT secret, and Fernet encryption key. The backend will refuse to start without valid `JWT_SECRET` and `ENCRYPTION_KEY` values.

To stop: `docker-compose down`. Data persists in the `pts_mysql_data` Docker volume. To wipe everything: `docker-compose down -v`.

## Configuration

Copy `.env.template` to `.env` manually, or run `bash setup.sh` (recommended) to auto-generate secure values.

| Variable | Default | Description |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | (generated) | MySQL root password |
| `MYSQL_DATABASE` | `pts_db` | Database name |
| `MYSQL_USER` | `pts_user` | Application database user |
| `MYSQL_PASSWORD` | (generated) | Application database password |
| `DB_HOST` | `db` | Database hostname (Docker service name) |
| `DB_PORT` | `3306` | Database port |
| `DB_USER` | `pts_user` | Backend DB user (must match `MYSQL_USER`) |
| `DB_PASS` | (generated) | Backend DB password (must match `MYSQL_PASSWORD`) |
| `DB_NAME` | `pts_db` | Backend DB name (must match `MYSQL_DATABASE`) |
| `JWT_SECRET` | (generated) | Secret for signing JWT tokens. Must be set. |
| `JWT_EXPIRY_HOURS` | `24` | Token lifetime in hours |
| `ENCRYPTION_KEY` | (generated) | Fernet key for encrypting IMAP passwords at rest. Must be set. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins (comma-separated). Never use `*`. |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |
| `BACKEND_URL` | `http://backend:8000` | Internal URL the frontend uses to reach the backend |
| `FRONTEND_BIND` | `0.0.0.0` | Bind address for frontend. Use `127.0.0.1` to restrict to localhost. |

## Deploying to Another Server

1. On the current server, log in and go to the Backup page. Download the JSON backup.
2. On the new server:
   ```bash
   git clone <repo-url>
   cd Personal-Ticket-System
   bash setup.sh
   docker-compose up -d --build
   ```
3. Register an account (becomes admin), then go to the Backup page and upload the backup file.

IMAP passwords are stripped from backups. After restoring, re-enter IMAP credentials for each profile.

## Project Structure

```
Personal-Ticket-System/
├── docker-compose.yml
├── .env.template
├── setup.sh
├── db-init/
│   └── 01-grant-access.sql      # Least-privilege DB grants
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── entrypoint.sh
│   └── app/
│       ├── main.py               # FastAPI app, lifespan, CORS, security headers, routers, extension download
│       ├── database.py           # SQLAlchemy engine and session
│       ├── models.py             # ORM models + enums (includes UserGameStats)
│       ├── schemas.py            # Pydantic request/response schemas
│       ├── auth.py               # Argon2id, JWT, Fernet, auth dependencies
│       ├── routers/
│       │   ├── auth.py           # Login, register, logout, change password
│       │   ├── admin.py          # User management (admin only)
│       │   ├── tickets.py        # Ticket CRUD (+ creation gamification)
│       │   ├── queue.py          # Queue next/complete/skip/stats (+ gamification events)
│       │   ├── recurring.py      # Recurring template CRUD
│       │   ├── config.py         # Queue weight config (admin only)
│       │   ├── imports.py        # CSV/Excel import + template download
│       │   ├── profiles.py       # Profile CRUD + IMAP test
│       │   ├── backup.py         # Backup download + restore
│       │   └── gamification.py   # Gamification stats + toggle
│       └── services/
│           ├── queue_service.py   # Scoring algorithm (uses last_skipped_at)
│           ├── gamification.py    # XP, levels, streaks, combos, achievements, challenges
│           ├── scheduler.py       # Recurring ticket + email polling loop
│           └── email_service.py   # IMAP email-to-ticket
├── chrome-extension/
│   ├── manifest.json             # Manifest V3
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Create ticket + queue logic + gamification bar
│   ├── popup.css                 # Styles
│   ├── options.html              # Settings page (server URL)
│   ├── options.js                # Settings logic
│   └── icons/                    # Extension icons (16/48/128)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── page.tsx               # Home dashboard
│       │   ├── layout.tsx             # Root layout + Navbar
│       │   ├── queue/page.tsx         # Queue workflow
│       │   ├── tickets/               # Ticket list, create, edit
│       │   ├── recurring/             # Recurring list, create, edit
│       │   ├── profiles/              # Profile list, create, edit
│       │   ├── config/page.tsx        # Queue weight settings (admin)
│       │   ├── import/page.tsx        # CSV/Excel import
│       │   ├── backup/page.tsx        # Backup & restore
│       │   ├── admin/users/page.tsx   # User management (admin)
│       │   ├── account/page.tsx       # Password change + extension download
│       │   └── gamification/page.tsx  # Task Quest dashboard
│       ├── components/
│       │   ├── Navbar.tsx             # Includes level badge when gamification enabled
│       │   ├── AuthGate.tsx
│       │   ├── TicketForm.tsx
│       │   ├── RecurringForm.tsx
│       │   └── GameEventToast.tsx     # XP toast notifications
│       └── lib/
│           ├── api.ts             # Typed API client
│           └── types.ts           # TypeScript interfaces
└── tests/
    ├── conftest.py                # Fixtures (admin/user/unauth sessions)
    ├── test_auth.py               # Auth flow tests
    ├── test_authorization.py      # RBAC, data isolation, IDOR
    ├── test_security.py           # Headers, CORS, cookies, rate limiting
    └── test_input_validation.py   # Input sanitization, enum validation
```

## API Reference

All endpoints are prefixed with `/api`. Auth-required endpoints read the JWT from the `access_token` httpOnly cookie.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Register a new account. First user becomes admin. |
| `POST` | `/api/auth/login` | No | Log in. Sets httpOnly cookie. |
| `POST` | `/api/auth/logout` | No | Clear auth cookie. |
| `GET` | `/api/auth/me` | Yes | Get current user info. |
| `POST` | `/api/auth/change-password` | Yes | Change password. Invalidates all other sessions. |

### Tickets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tickets` | Yes | List tickets. Query: `status`, `priority`, `profile_id`, `sort_by`, `sort_order`. |
| `POST` | `/api/tickets` | Yes | Create a ticket. |
| `GET` | `/api/tickets/{id}` | Yes | Get a ticket by ID. |
| `PUT` | `/api/tickets/{id}` | Yes | Update a ticket. |
| `DELETE` | `/api/tickets/{id}` | Yes | Delete a ticket. |

### Queue

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/queue/next` | Yes | Get next ticket (lowest score). Query: `profile_id`. |
| `POST` | `/api/queue/complete/{id}` | Yes | Mark ticket as completed. |
| `POST` | `/api/queue/skip/{id}` | Yes | Skip ticket (increments skip count, sets `last_skipped_at`, resets effective age). |
| `GET` | `/api/queue/stats` | Yes | Ticket counts by status. Query: `profile_id`. |

### Recurring Templates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/recurring` | Yes | List templates. Query: `profile_id`. |
| `POST` | `/api/recurring` | Yes | Create a template. |
| `GET` | `/api/recurring/{id}` | Yes | Get a template. |
| `PUT` | `/api/recurring/{id}` | Yes | Update a template. |
| `DELETE` | `/api/recurring/{id}` | Yes | Delete a template. |

### Profiles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/profiles` | Yes | List user's profiles. |
| `POST` | `/api/profiles` | Yes | Create a profile. |
| `GET` | `/api/profiles/{id}` | Yes | Get a profile. |
| `PUT` | `/api/profiles/{id}` | Yes | Update a profile (including IMAP config). |
| `DELETE` | `/api/profiles/{id}` | Yes | Delete a profile (must have no tickets/templates). |
| `POST` | `/api/profiles/{id}/test-email` | Yes | Test IMAP connection. Rate limited: 3/min. |

### Import/Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/import` | Yes | Import tickets from CSV/Excel. Multipart form: `file`, optional `profile_id`. |
| `GET` | `/api/import/template` | Yes | Download Excel import template. |

### Backup

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/backup` | Yes | Download JSON backup. Admin gets all data; users get own data. |
| `POST` | `/api/backup/restore` | Yes | Restore from JSON backup. Multipart form: `file`. |

### Config (Admin Only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/config` | Admin | Get queue weight configuration. |
| `PUT` | `/api/config` | Admin | Update queue weights. |
| `POST` | `/api/config/reset` | Admin | Reset weights to defaults. |

### Admin (Admin Only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/users` | Admin | List all users. |
| `PUT` | `/api/admin/users/{id}/role` | Admin | Change a user's role. |
| `PUT` | `/api/admin/users/{id}/active` | Admin | Activate/deactivate a user. Invalidates their tokens. |
| `DELETE` | `/api/admin/users/{id}` | Admin | Delete a user. |

### Gamification

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/gamification/stats` | Yes | Get full game stats (level, XP, streak, combo, achievements, challenges). |
| `POST` | `/api/gamification/toggle` | Yes | Enable/disable gamification. Body: `{"enabled": true}`. |

### Extension

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/extension/download` | No | Download Chrome extension as a zip file. |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check. Returns `{"status": "ok"}`. |

## Security

- **Secrets management**: All secrets live in `.env` (auto-generated by `setup.sh`). App refuses to start without `JWT_SECRET` and `ENCRYPTION_KEY`.
- **Password hashing**: Argon2id with tuned parameters (time_cost=3, memory=64MB, parallelism=4).
- **Password policy**: 8+ chars, must include uppercase, lowercase, digit, and special character.
- **JWT tokens**: Stored in httpOnly cookies with SameSite=Lax. Token versioning invalidates sessions on password change or account deactivation.
- **CORS**: Restricted to configured origins. Never uses wildcard.
- **Rate limiting**: 5 login attempts per username per 5 minutes, 20 per IP per 5 minutes. IMAP test: 3 per minute.
- **Security headers**: X-Frame-Options DENY, X-Content-Type-Options nosniff, CSP, HSTS, Referrer-Policy, Permissions-Policy. Server header masked.
- **Input sanitization**: HTML tags stripped from ticket/template text fields. Sort field whitelist prevents getattr injection. Enum validation on all dropdowns.
- **SSRF protection**: IMAP host validation blocks localhost, private IPs, Docker-internal hostnames.
- **Encryption at rest**: IMAP passwords encrypted with Fernet before database storage.
- **Data isolation**: All queries are scoped to the authenticated user's profiles. Ownership checks prevent IDOR.
- **File upload limits**: 10MB for imports, 50MB for backups, 5000-row import limit.
- **CSV injection prevention**: Formula prefix characters stripped on import.
- **Timing attack prevention**: Dummy password hash on failed login to prevent username enumeration.
- **Database**: Least-privilege grants (SELECT, INSERT, UPDATE, DELETE, ALTER, CREATE, INDEX). DB password URL-encoded in connection string.
- **Audit logging**: Auth and admin operations are logged with usernames and actions.

## Testing

The test suite contains 56 tests covering auth flows, password policy, rate limiting, security headers, CORS, cookie attributes, data isolation, input validation, and IDOR prevention.

```bash
# Start the stack
docker-compose up -d --build

# Run tests against the running backend
pip install pytest requests
pytest tests/ -v
```

Tests run against `http://127.0.0.1:9999` by default. Set `PTS_TEST_URL` to override. For existing databases with users, set `PTS_ADMIN_USER` and `PTS_ADMIN_PASS`.

## License

MIT
