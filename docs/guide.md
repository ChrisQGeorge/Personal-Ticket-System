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

- **Complete** -- marks the ticket as "completed", removes it from the queue, loads the next ticket. If gamification is enabled, you earn XP.
- **Skip** -- increments the ticket's skip count by 1, sets `last_skipped_at` to now, marks it "skipped", loads the next ticket. The skipped ticket stays in the queue but is pushed to the back (its effective age resets and a skip penalty is added). If gamification is enabled, you lose 50 XP and your combo resets.

When all tickets are done, the page shows an empty-state message.

You can filter the queue by profile using the profile selector.

**How queue order works (plain English):**

Every non-completed ticket gets a numeric score. Lower score = served first. The factors:

- **Older tickets** naturally surface first (FIFO baseline).
- **Higher priority** tickets get a score boost that moves them up.
- **Approaching deadlines** push tickets up. Overdue tickets jump to the top with a large penalty.
- **Skipped tickets** are pushed to the back: their effective age resets to the skip time, and skip count adds a penalty. You cannot avoid them forever, but they will not come back immediately.
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

The Account page also includes a **Download Extension** button to download the Chrome extension as a zip file.

---

### Gamification -- Task Quest

Task Quest is an opt-in gamification layer that turns your task management into a progression system with XP, levels, streaks, combos, achievements, and challenges.

**Enabling gamification:**

- Go to **/gamification** from the nav bar, or toggle it on from the Account page.
- Once enabled, you will see a level badge in the navbar and a gamification summary card on the home page.
- Disable it at any time from the /gamification page (toggle at the bottom). Your progress is preserved.

**XP system:**

You earn XP for completing and creating tickets, and lose XP for skipping.

| Action | Base XP | Notes |
|---|---|---|
| Complete a ticket | 50-250 (by priority) | very low = 50, low = 75, default = 100, high = 150, very high = 250 |
| Create a ticket | 25 | +10-15 for high/very high priority, +10 for setting a due date, +5 for setting effort estimate |
| Skip a ticket | -50 | Also resets your combo to 0 |

**Completion multipliers** stack on the base completion XP before other bonuses:

| Multiplier | Condition | Value |
|---|---|---|
| Effort | Est. hours > 2 | 1.5x (2-5h), 2.0x (5-10h), 2.5x (10+h) |
| Streak | 3+ day streak | +10% per day, max +100% |
| Combo | 3+ completions without skip | 1.2x (3), 1.4x (5), 1.75x (10+) |

Early completion bonus: +50 XP if 3+ days early, +100 XP if 7+ days early. Overdue penalty: -25 XP per overdue day (max -500). Minimum 10 XP per completion.

**Levels and ranks:**

There are 100 levels. XP requirements scale: 500 per level for 1-10, 1000 for 11-25, 2000 for 26-50, 3500 for 51-75, 5000 for 76-100.

| Level Range | Rank Title |
|---|---|
| 1-5 | Apprentice |
| 6-10 | Journeyman |
| 11-15 | Expert |
| 16-20 | Master |
| 21-25 | Grandmaster |
| 26-30 | Myth-Seeker |
| 31-50 | Legend |
| 51-75 | Titan |
| 76-99 | Immortal |
| 100 | Ascended One |

**Streaks:**

Complete at least 1 ticket per day to maintain your streak. Bonuses kick in at 3, 7, 14, and 30 days (via streak multiplier and achievements). At a 30-day streak, you unlock a **streak shield** -- a one-time protection that saves your streak if you miss a day.

**Combos:**

Each ticket you complete without skipping increases your combo counter. The combo multiplier applies to completion XP. Skipping any ticket resets the combo to 0.

**Achievements (22 total):**

Achievements are unlocked automatically and award bonus XP. Categories include:

- **Starter:** First Blood (first completion), Ticket Writer (first creation), Consistent (3-day streak), Power Starter (5 in one day)
- **Grind:** Momentum (7-day streak), Heavyweight (10+ hour ticket), Perfect Execution (complete 2+ days early), Unstoppable (14-day streak), No Skips Club (25 combo)
- **Mastery:** Centurion (100 completions), Skill Collector (level 25), Task Titan (level 50), Iron Discipline (30-day streak), Flow Master (10 in one day with 10+ combo)
- **Prestige:** Legend (level 75), Ascended (level 100), Overachiever (500 completions), Mythical Streak (100-day streak), The Thousand (1000 completions)
- **Creation:** Ticket Writer (1 created), The Planner (10), Backlog Builder (50), Ticket Machine (200), World Builder (500)

**Daily challenges:**

3 random challenges selected each day. Examples: "Power Hour" (complete 3 high-priority tickets, 200 XP), "Speedster" (complete 5 tickets, 150 XP), "Task Planner" (create 5 tickets, 100 XP), "Full Pipeline" (create 3 and complete 3, 250 XP).

**Weekly challenges:**

1 challenge per week. Examples: "The Cleaner" (complete 20 tickets, 500 XP), "Priority Master" (complete 10 high+ priority, 400 XP), "Streak Keeper" (maintain 7-day streak, 600 XP).

**Gamification dashboard (/gamification):**

- XP progress bar showing current level, rank, and XP to next level
- Stat cards: streak, combo, completion rate, tickets completed today
- Daily challenge cards with progress bars
- Weekly challenge card with progress bar
- Achievement grid showing locked/unlocked status and XP rewards
- Personal records: longest streak, total completed, total skipped, current combo

**XP toast notifications:**

When you complete, skip, or create a ticket, a toast notification appears in the top-right corner showing XP earned/lost, level-up announcements, new achievements, and completed challenges. Toasts auto-dismiss after 3-4 seconds.

---

### Chrome Extension

The Chrome extension lets you create tickets and work your queue from any browser tab without navigating to the PTS web app.

**Installing the extension:**

1. Go to the **Account** page in the PTS web app and click **Download Extension** (or visit `/api/extension/download` directly).
2. Extract the downloaded zip file to a folder on your computer.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the extracted folder.
6. The PTS icon appears in your browser toolbar.

**First-time setup:**

1. Click the PTS extension icon.
2. Enter your server URL (e.g., `http://localhost:3000`) and click Connect.
3. Log in with your PTS username and password. The extension uses the same cookie-based auth as the web app.

**Using the extension:**

The extension popup has two tabs:

- **Create Ticket** -- fill in title, description, priority, estimated hours, due date, and profile. Click Create.
- **Queue** -- shows the next ticket in your queue. Complete or skip it, and the next one loads automatically. Select a profile to filter.

**Gamification bar:**

If gamification is enabled, the extension shows a bar at the top with your current level, rank, XP, streak count, and combo count. When you complete, skip, or create a ticket, game event notifications appear inline showing XP gained/lost, level-ups, and new achievements.

**Settings:**

Click the gear icon to open the options page where you can change the server URL. The URL is stored in Chrome sync storage, so it carries across devices if you are signed into Chrome.

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
├── main.py          # App setup: lifespan (migrations, scheduler), CORS, security headers, routers, extension download
├── database.py      # SQLAlchemy engine, SessionLocal, get_db dependency
├── models.py        # ORM models + enums (User, Profile, Ticket, RecurringTemplate, QueueConfig, UserGameStats)
├── schemas.py       # Pydantic models for request/response validation
├── auth.py          # Password hashing (Argon2id), JWT creation/validation, Fernet encryption, auth dependencies
├── routers/
│   ├── auth.py      # Login, register, logout, change-password, rate limiting
│   ├── admin.py     # User management (list, role change, activate/deactivate, delete)
│   ├── tickets.py   # Ticket CRUD with ownership verification (+ creation gamification)
│   ├── queue.py     # Next ticket, complete, skip, stats (+ gamification events)
│   ├── recurring.py # Recurring template CRUD
│   ├── config.py    # Queue weight config (admin only)
│   ├── imports.py   # CSV/Excel import + template download
│   ├── profiles.py  # Profile CRUD, IMAP config, test-email
│   ├── backup.py    # JSON backup download + restore
│   └── gamification.py  # GET /stats, POST /toggle
└── services/
    ├── queue_service.py   # Scoring algorithm: compute_score(), get_next_ticket() (uses last_skipped_at)
    ├── gamification.py    # XP calculation, levels, streaks, combos, achievements, daily/weekly challenges
    ├── scheduler.py       # Background loop: recurring templates + email polling (60s interval)
    └── email_service.py   # IMAP connection, email parsing, ticket creation, SSRF checks
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
│   ├── account/page.tsx        # Password change + extension download
│   └── gamification/page.tsx   # Task Quest dashboard
├── components/
│   ├── Navbar.tsx              # Navigation, responsive mobile menu, level badge
│   ├── AuthGate.tsx            # Authentication wrapper, redirects to login
│   ├── TicketForm.tsx          # Shared create/edit ticket form
│   ├── RecurringForm.tsx       # Shared create/edit template form
│   └── GameEventToast.tsx      # XP toast notifications (complete/skip/create)
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
| last_skipped_at | DATETIME | Nullable. Set on skip; used as effective age in queue scoring. |
| profile_id | INT | FK -> profiles.id |

#### `user_game_stats`

| Column | Type | Constraints |
|---|---|---|
| id | INT | PK, auto-increment |
| user_id | INT | FK -> users.id, UNIQUE |
| gamification_enabled | BOOLEAN | NOT NULL, default false |
| total_xp | INT | NOT NULL, default 0 |
| current_level | INT | NOT NULL, default 1 |
| current_streak | INT | NOT NULL, default 0 |
| longest_streak | INT | NOT NULL, default 0 |
| last_completion_date | DATE | Nullable |
| combo_count | INT | NOT NULL, default 0 |
| combo_last_date | DATE | Nullable |
| total_completed | INT | NOT NULL, default 0 |
| total_skipped | INT | NOT NULL, default 0 |
| total_created | INT | NOT NULL, default 0 |
| tickets_completed_today | INT | NOT NULL, default 0 |
| today_date | DATE | Nullable |
| weekly_skips | INT | NOT NULL, default 0 |
| weekly_skips_reset | DATE | Nullable |
| streak_shield_available | BOOLEAN | NOT NULL, default false |
| streak_shield_used | BOOLEAN | NOT NULL, default false |
| unlocked_achievements | TEXT | JSON array of achievement IDs |
| daily_challenges | TEXT | JSON array of daily challenge objects |
| daily_challenge_date | DATE | Nullable |
| weekly_challenge | TEXT | JSON object for weekly challenge |
| weekly_challenge_date | DATE | Nullable |

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
score = (days_since_effective_date * age_weight)
      - priority_offset
      + (skip_count * skip_weight)
      + (est_hours * effort_weight)
      - due_date_urgency
```

Where `effective_date = last_skipped_at` if the ticket has been skipped, otherwise `date_created`.

**Term breakdown:**

| Term | Formula | Effect |
|---|---|---|
| Age | `days_since_effective_date * age_weight` | Older tickets get higher base scores (lower = served first is achieved by other terms subtracting from it). When a ticket is skipped, `last_skipped_at` replaces `date_created` for age calculation, effectively resetting the ticket's age to zero. Default: 10 points per day. |
| Priority offset | Lookup from config | Subtracted from score. Very high = -40 (subtracting -40 = +40 added), so high-priority tickets get lower scores. Very low = +40 (subtracting +40 = -40), so low-priority tickets sink. |
| Skip penalty | `skip_count * skip_weight` | Added to score. More skips = higher score = served later. Skipped tickets are pushed to the back of the queue. Default: 15 per skip. |
| Effort penalty | `est_hours * effort_weight` | Added to score. More hours = higher score = served later. Gives a slight preference to quick tasks. Default: 5 per hour. |
| Due date urgency | If overdue: `overdue_penalty` (default -100). Otherwise: `days_until_due * -due_date_weight`. | Subtracted from score. Overdue tickets get a massive boost. Approaching deadlines get a proportional boost. |

**Skip behavior (updated):**

When a ticket is skipped, two things happen that push it to the back of the queue:

1. `last_skipped_at` is set to the current time. The scoring formula uses this instead of `date_created` for the age term, effectively resetting the ticket's accumulated age priority to zero.
2. `skip_count` is incremented. Skip count is now ADDED to the score (positive contribution), which pushes the ticket further back.

The combined effect is that a skipped ticket loses all its age-based priority and gets an additional penalty. It will only resurface as time passes and its effective age grows again, or if its priority/due date pull it forward.

**Worked example:**

Ticket A: created 5 days ago, "high" priority, never skipped, 1 hour estimate, due in 2 days.

```
effective_date = date_created (5 days ago)
score = (5 * 10) - (-20) + (0 * 15) + (1 * 5) - (2 * -3)
      = 50 + 20 + 0 + 5 + 6
      = 81
```

Ticket B: created 5 days ago, skipped once 1 hour ago, "high" priority, 1 hour estimate, due in 2 days.

```
effective_date = last_skipped_at (0.04 days ago)
score = (0.04 * 10) - (-20) + (1 * 15) + (1 * 5) - (2 * -3)
      = 0.4 + 20 + 15 + 5 + 6
      = 46.4
```

Ticket C: 1 day old, "default" priority, no skips, 0.5 hours, no due date.

```
score = (1 * 10) - 0 + 0 + (0.5 * 5) - 0
      = 10 + 2.5
      = 12.5
```

Ticket C (12.5) is served first, then Ticket B (46.4), then Ticket A (81).

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

### Gamification Service

Located in `backend/app/services/gamification.py`. This service handles all XP calculations, leveling, streaks, combos, achievements, and challenges.

**Entry points (called from routers):**

- `process_ticket_completion(db, user_id, ticket)` -- called from `queue.py` on complete. Updates counters, calculates XP with multipliers, updates streak/combo, checks achievements and challenges, applies XP. Returns a `game_event` dict or `None` if gamification is disabled.
- `process_ticket_skip(db, user_id)` -- called from `queue.py` on skip. Resets combo, subtracts 50 XP (capped at current XP so it never goes below 0). Returns a `game_event` dict or `None`.
- `process_ticket_creation(db, user_id, ticket)` -- called from `tickets.py` on create. Awards 25 base XP plus bonuses for priority, due date, and effort estimate. Checks creation achievements and challenges. Returns a `game_event` dict or `None`.
- `get_stats_response(db, user_id)` -- called from `gamification.py` router. Returns full stats including XP, level, rank, streak, combo, all achievements, daily challenges, and weekly challenge.

**XP formula for completion:**

```
raw_xp = int(base_xp * effort_multiplier * streak_multiplier * combo_multiplier) + early_bonus - overdue_penalty
total_xp = max(raw_xp, 10)  # Minimum 10 XP per completion
```

Plus achievement XP and challenge XP are added on top.

**Level thresholds (`xp_for_level`):**

| Level Range | XP per Level |
|---|---|
| 1-10 | 500 |
| 11-25 | 1,000 |
| 26-50 | 2,000 |
| 51-75 | 3,500 |
| 76-100 | 5,000 |

**Streak logic:**

- If `last_completion_date` is yesterday, streak increments.
- If `last_completion_date` is today, no change (already counted).
- If more than 1 day gap, streak resets to 1 (unless streak shield is available and unused).
- Streak shield is unlocked at 30-day streak and provides one-time protection.

**Challenge generation:**

- Daily challenges: 3 selected from a pool of 8 using `random.sample()`. Reset when the date changes.
- Weekly challenge: 1 selected from a pool of 4 using `random.choice()`. Reset every 7 days.
- Challenge progress is updated after each completion and stored as JSON in the `user_game_stats` row.

**Achievement checking:**

Each achievement has a lambda `check` function that evaluates against the current `UserGameStats` and optionally the ticket. Achievements are checked after every completion and creation. Newly unlocked achievements return bonus XP.

---

### Chrome Extension Architecture

Located in `chrome-extension/`. A standalone Manifest V3 Chrome extension with no build tools.

**Files:**
- `manifest.json` -- Manifest V3, permissions: `storage`, host_permissions: `<all_urls>`.
- `popup.html` / `popup.js` / `popup.css` -- Main popup UI with tabs (Create Ticket, Queue).
- `options.html` / `options.js` -- Settings page for server URL configuration.
- `icons/` -- Extension icons in 16, 48, and 128px.

**How it works:**
- Server URL is stored in `chrome.storage.sync` and persists across devices.
- The extension calls the same REST API endpoints as the web frontend, using `credentials: 'include'` to send cookies.
- Login is handled directly in the popup via `POST /api/auth/login`.
- After login, it fetches profiles (`GET /api/profiles`) and gamification stats (`GET /api/gamification/stats`).
- Create Ticket tab posts to `POST /api/tickets` with profile, title, description, priority, hours, and due date.
- Queue tab fetches `GET /api/queue/next` and offers complete/skip buttons that call the queue endpoints.
- Game events from complete/skip/create responses are shown inline with `showGameEvent()`.

**Extension download endpoint (`GET /api/extension/download`):**
- Defined in `main.py` (not behind auth).
- Zips the `chrome-extension/` directory on the fly and returns it as `pts-chrome-extension.zip`.
- The Account page in the web frontend links to this endpoint via a download button.

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

Only `title` is required. Response `201`: the created ticket object. If gamification is enabled, the response includes a `game_event` field with XP earned (25 base + bonuses), new achievements, and level info.

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

Sets status to "completed". Response `200`: the ticket object. If gamification is enabled, the response includes a `game_event` field:

```json
{
  "id": 3,
  "title": "Do laundry",
  "status": "completed",
  "game_event": {
    "xp_earned": 150,
    "xp_breakdown": { "base": 100, "effort_multiplier": 1.0, "streak_multiplier": 1.3, "combo_multiplier": 1.2, "early_bonus": 0, "overdue_penalty": 0, "total": 150 },
    "new_total_xp": 1250,
    "level": 3,
    "leveled_up": false,
    "new_level": null,
    "rank_title": "Apprentice",
    "streak": 4,
    "combo": 5,
    "new_achievements": [],
    "challenge_progress": [{ "name": "Speedster", "progress": 3, "target": 5, "completed": false }]
  }
}
```

---

**`POST /api/queue/skip/{id}`** -- Skip a ticket

Sets status to "skipped", increments `skip_count`, sets `last_skipped_at` to the current UTC time. The `last_skipped_at` timestamp is used as the effective date for queue age scoring, resetting the ticket's age priority. Response `200`: the ticket object. If gamification is enabled, the response includes a `game_event` field:

```json
{
  "game_event": {
    "xp_lost": 50,
    "new_total_xp": 1200,
    "level": 3,
    "rank_title": "Apprentice",
    "combo_reset": true,
    "weekly_skips": 2
  }
}
```

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

#### Gamification

**`GET /api/gamification/stats`** -- Get gamification stats

Auth required.

Response `200`:
```json
{
  "gamification_enabled": true,
  "total_xp": 1250,
  "current_level": 3,
  "xp_for_current_level": 1000,
  "xp_for_next_level": 1500,
  "xp_progress": 250,
  "rank_title": "Apprentice",
  "current_streak": 4,
  "longest_streak": 12,
  "streak_shield_available": false,
  "combo_count": 5,
  "total_completed": 28,
  "total_skipped": 3,
  "total_created": 35,
  "completion_rate": 90.3,
  "tickets_completed_today": 3,
  "achievements": [
    { "id": "first_blood", "name": "First Blood", "description": "Complete your first ticket", "xp": 50, "unlocked": true }
  ],
  "daily_challenges": [
    { "id": "speedster", "name": "Speedster", "description": "Complete 5 tickets today", "target": 5, "xp": 150, "type": "total_today", "progress": 3 }
  ],
  "weekly_challenge": {
    "id": "cleaner", "name": "The Cleaner", "description": "Complete 20 tickets this week", "target": 20, "xp": 500, "type": "weekly_total", "progress": 8
  }
}
```

---

**`POST /api/gamification/toggle`** -- Enable or disable gamification

Auth required.

Request:
```json
{ "enabled": true }
```

Response `200`:
```json
{ "gamification_enabled": true }
```

---

#### Extension

**`GET /api/extension/download`** -- Download Chrome extension

No auth required. Returns the `chrome-extension/` directory as a zip file.

Response headers: `Content-Disposition: attachment; filename=pts-chrome-extension.zip`

---

#### Health

**`GET /api/health`**

Response `200`: `{"status": "ok"}`
