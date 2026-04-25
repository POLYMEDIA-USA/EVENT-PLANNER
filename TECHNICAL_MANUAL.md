# FunnelFlow - Technical Manual

**App Version:** 0.10.8
**Last Updated:** 2026-04-23

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Configuration & Environment](#3-configuration--environment)
4. [Data Storage (GCS)](#4-data-storage-gcs)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Application Workflows](#7-application-workflows)
8. [API Reference](#8-api-reference)
9. [React Components](#9-react-components)
10. [Email System](#10-email-system)
11. [SMS Integration](#11-sms-integration)
12. [RSVP & Check-In System](#12-rsvp--check-in-system)
13. [File Attachments](#13-file-attachments)
14. [Reporting & Analytics](#14-reporting--analytics)
15. [Deployment](#15-deployment)
16. [Troubleshooting](#16-troubleshooting)
17. [Data Schema Reference](#17-data-schema-reference)

---

## 1. System Overview

### Platform

- **App Name:** FunnelFlow (formerly CorpMarketer)
- **Purpose:** Corporate event lead-tracking, invitation management, and sales funnel platform
- **Framework:** Next.js 14.2.0 (App Router)
- **Runtime:** Node.js 20 (Alpine Linux container)
- **UI:** React 18, Tailwind CSS 3.3
- **Database:** Google Cloud Storage (JSON file-based)
- **Email:** Nodemailer (SMTP)
- **SMS:** Vonage (Nexmo REST API)
- **Hosting:** Google Cloud Run (managed, serverless)

### Software Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.0 | React framework with App Router and API routes |
| `react` / `react-dom` | ^18 | UI library |
| `@google-cloud/storage` | ^7.19.0 | GCS bucket read/write for all data persistence |
| `nodemailer` | ^8.0.2 | SMTP email sending (invitations, reminders, etc.) |
| `papaparse` | ^5.5.3 | CSV parsing for lead import |
| `xlsx` | ^0.18.5 | Excel file parsing for lead import |
| `jsqr` | ^1.4.0 | QR code decoding from camera frames |
| `multer` | ^2.1.1 | Multipart file upload handling |
| `uuid` | ^9.0.0 | UUID generation for records and tracking |
| `tailwindcss` | ^3.3.0 | Utility-first CSS framework |

### Repository

- **GitHub:** POLYMEDIA-USA/EVENT-PLANNER
- **Branch:** main
- **Git Tags:** v0.2.0 through v0.8.2

---

## 2. Architecture

### File Structure

```
EVENT PLANNER/
├── src/
│   ├── app/
│   │   ├── layout.js                    # Root layout (AuthProvider, viewport meta)
│   │   ├── page.js                      # Login/Register page ('/')
│   │   ├── globals.css                  # Global styles
│   │   │
│   │   ├── api/                         # API Routes (27 endpoints)
│   │   │   ├── audit/route.js           # GET: audit log
│   │   │   ├── auth/
│   │   │   │   ├── login/route.js       # POST: login
│   │   │   │   ├── me/route.js          # GET: current user
│   │   │   │   └── register/route.js    # POST: register
│   │   │   ├── email/
│   │   │   │   ├── log/route.js         # GET: email logs
│   │   │   │   ├── send-invites/route.js # POST: send bulk emails
│   │   │   │   ├── send-users/route.js  # POST: admin notifications
│   │   │   │   ├── templates/route.js   # GET/POST/PUT/DELETE: templates
│   │   │   │   └── track/route.js       # GET: open/click tracking pixel
│   │   │   ├── events/
│   │   │   │   ├── route.js             # GET/POST/PUT/DELETE: events
│   │   │   │   └── ical/route.js        # GET: iCal export
│   │   │   ├── gcs/route.js             # GET: list GCS files
│   │   │   ├── interactions/
│   │   │   │   ├── route.js             # GET/POST: interactions
│   │   │   │   ├── attachment/route.js  # GET: signed URL refresh
│   │   │   │   └── upload/route.js      # POST: file upload to GCS
│   │   │   ├── invited/route.js         # GET/POST: invitation management
│   │   │   ├── leads/
│   │   │   │   ├── route.js             # GET/POST/PUT/DELETE: leads
│   │   │   │   ├── duplicates/route.js  # GET/POST: dedup
│   │   │   │   └── import/route.js      # POST: CSV/XLSX import
│   │   │   ├── reports/
│   │   │   │   ├── post-event/route.js  # GET/POST: post-event report
│   │   │   │   └── stats/route.js       # GET: pipeline stats
│   │   │   ├── reps/route.js            # GET: sales reps
│   │   │   ├── rsvp/route.js            # GET/POST: RSVP responses
│   │   │   ├── settings/
│   │   │   │   ├── route.js             # GET/POST: app settings
│   │   │   │   └── users/route.js       # GET/POST/PUT/DELETE: users
│   │   │   ├── sms/send/route.js        # POST: send SMS
│   │   │   └── tasks/route.js           # GET/POST/PUT/DELETE: tasks
│   │   │
│   │   ├── audit/page.js               # Audit log viewer
│   │   ├── checkin-dashboard/page.js    # Live check-in display
│   │   ├── dashboard/page.js            # Main dashboard
│   │   ├── events/page.js               # Event management
│   │   ├── interactions/page.js         # Interaction log
│   │   ├── invited/page.js              # Invitation & email sending
│   │   ├── leads/page.js               # Lead management
│   │   ├── reports/page.js              # Reports & analytics
│   │   ├── reps/page.js                # Sales reps (supervisor)
│   │   ├── rsvp/page.js                # RSVP confirmation page
│   │   ├── scanner/page.js             # QR code scanner
│   │   ├── settings/page.js            # App settings
│   │   ├── tasks/page.js               # Task management
│   │   └── users/page.js               # User management
│   │
│   ├── components/
│   │   ├── AppShell.js                  # Layout wrapper, auth guard, event banner
│   │   ├── AuthProvider.js              # Auth context & hooks
│   │   ├── FileImportWizard.js          # Multi-step CSV/XLSX import dialog
│   │   ├── Pagination.js               # Reusable pagination with page size selector
│   │   └── Sidebar.js                   # Desktop sidebar + mobile bottom tab bar
│   │
│   └── lib/
│       ├── gcs.js                       # GCS data layer (read/write/cache)
│       ├── auth.js                      # Password hashing, token generation
│       └── audit.js                     # Audit log helper
│
├── public/
│   ├── logo.png                         # App logo
│   ├── admin-guide.html                 # Admin user guide
│   ├── supervisor-guide.html            # Supervisor user guide
│   ├── sales-rep-guide.html             # Sales rep user guide
│   └── corpmarketer-workflow-guide.html # Workflow documentation
│
├── package.json                         # Dependencies and scripts
├── next.config.mjs                      # Next.js config (standalone output)
├── tailwind.config.js                   # Tailwind CSS config
├── postcss.config.js                    # PostCSS config
├── jsconfig.json                        # Path alias (@/* → ./src/*)
├── Dockerfile                           # Multi-stage Docker build
├── DEPLOY.md                            # Deployment instructions
└── TECHNICAL_MANUAL.md                  # This file
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `src/lib/gcs.js` | All data persistence — read/write JSON files to GCS bucket with in-memory cache (5s TTL) and in-flight request deduplication |
| `src/lib/auth.js` | Password hashing (PBKDF2-SHA512), session token generation, token verification |
| `src/lib/audit.js` | Audit log creation with auto-cleanup (keeps last 1000 entries) |
| `src/components/AuthProvider.js` | Client-side auth state management, token storage in localStorage, auto-redirect |
| `src/components/AppShell.js` | Authenticated layout wrapper, sidebar integration, "no event selected" banner |
| `src/components/Sidebar.js` | Role-based navigation, collapsible desktop sidebar, mobile bottom tab bar |
| `src/components/Pagination.js` | Reusable pagination with page size selector (25/50/100), shared across all list pages |
| `src/components/FileImportWizard.js` | Multi-step import dialog: upload → column mapping → preview → import |

### Data Flow

```
User Browser (React 18 + Tailwind CSS)
    │
    ├── localStorage: cm_token, cm_user, cm_event
    │
    ▼
Next.js API Routes (Bearer token auth)
    │
    ├── authenticate() → verifies token against users.json
    │
    ▼
src/lib/gcs.js (Data Access Layer)
    │
    ├── In-memory cache (5s TTL)
    ├── In-flight request deduplication
    │
    ▼
Google Cloud Storage (corpmarketer-bucket)
    │
    ├── JSON data files (users, customers, events, etc.)
    └── attachments/* (photos, documents)
```

### Performance Architecture

| Technique | Location | Purpose |
|-----------|----------|---------|
| In-memory cache (5s TTL) | `gcs.js` | Eliminates redundant GCS reads within time window |
| In-flight deduplication | `gcs.js` | Concurrent requests for same file share one download |
| Write-through cache | `gcs.js` | Cache updated immediately on writes for instant reads |
| `useMemo` on filtered arrays | All list pages | Prevents re-computation on every render |
| `Promise.all` parallel fetches | Tasks, reps, check-in dashboard | Loads multiple data files concurrently |
| Targeted state updates | Tasks, interactions | Updates only changed records after mutations |

---

## 3. Configuration & Environment

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GCS_BUCKET` | `event-planner-bucket` | Google Cloud Storage bucket name |
| `NODE_ENV` | `production` (Docker) | Node.js environment |
| `PORT` | `3000` | Server port |
| `HOSTNAME` | `0.0.0.0` | Server bind address |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |

### next.config.mjs

```javascript
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',    // Self-contained deployment (no node_modules at runtime)
};
```

### jsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]   // Import alias: @/lib/gcs → src/lib/gcs
    }
  }
}
```

### Tailwind Configuration

Standard configuration scanning `src/pages/**`, `src/components/**`, and `src/app/**` for class names. No custom theme extensions. Plugins: none.

---

## 4. Data Storage (GCS)

### Overview

FunnelFlow uses Google Cloud Storage as its database, storing all application data as JSON files in a single bucket. There is no traditional database — all reads and writes go through `src/lib/gcs.js`.

### Bucket Details

| Field | Value |
|-------|-------|
| **Bucket Name** | `corpmarketer-bucket` |
| **GCP Project** | `corpmarketer-app` |
| **Region** | `us-central1` |
| **Access** | Cloud Run service account (auto-configured) |

### Data Files

| File | Default Empty | Description |
|------|---------------|-------------|
| `users.json` | `[]` | User accounts with password hashes and session tokens |
| `customers.json` | `[]` | Leads/contacts with status, scoring, and RSVP data |
| `events.json` | `[]` | Events with dates, locations, and status |
| `event_assignments.json` | `[]` | Customer-to-event mappings |
| `interactions.json` | `[]` | Customer interaction log entries |
| `tasks.json` | `[]` | Follow-up tasks with assignments and due dates |
| `email_logs.json` | `[]` | Email send log with tracking data |
| `email_templates.json` | `[]` | Custom email templates |
| `user_event_attendance.json` | `[]` | Team-member attendance records per event (see Team Attendance section) |
| `audit_log.json` | `[]` | System audit trail (auto-trimmed to 1000 entries) |
| `organizations.json` | `[]` | Organization records |
| `settings.json` | `{}` | App settings (SMTP, Vonage, branding) |
| `attachments/*` | — | Uploaded photos and documents (binary files) |

### GCS Access Layer (gcs.js)

**Exported Functions:**

| Function | File | Purpose |
|----------|------|---------|
| `getUsers()` / `saveUsers(data)` | `users.json` | User account CRUD |
| `getCustomers()` / `saveCustomers(data)` | `customers.json` | Lead/contact CRUD |
| `getEvents()` / `saveEvents(data)` | `events.json` | Event CRUD |
| `getEventAssignments()` / `saveEventAssignments(data)` | `event_assignments.json` | Event-customer mappings |
| `getInteractions()` / `saveInteractions(data)` | `interactions.json` | Interaction log |
| `getTasks()` / `saveTasks(data)` | `tasks.json` | Task management |
| `getEmailLogs()` / `saveEmailLogs(data)` | `email_logs.json` | Email send history |
| `getEmailTemplates()` / `saveEmailTemplates(data)` | `email_templates.json` | Email templates |
| `getAuditLog()` / `saveAuditLog(data)` | `audit_log.json` | Audit trail |
| `getOrganizations()` / `saveOrganizations(data)` | `organizations.json` | Organizations |
| `getSettings()` / `saveSettings(data)` | `settings.json` | App configuration |
| `readJSON(filename)` | Any | Generic JSON file read |
| `writeJSON(filename, data)` | Any | Generic JSON file write |
| `listFiles()` | — | List all files in bucket |
| `readText(filename)` | — | Read raw text file |

**Caching Strategy:**

```
Read Request
    │
    ├── Check in-memory cache (Map)
    │   └── If cached && age < 5000ms → return cached data
    │
    ├── Check in-flight map
    │   └── If another request is already fetching → piggyback on that Promise
    │
    └── Fetch from GCS
        ├── File exists → parse JSON, cache result, return
        └── File missing → return [] (or {} for settings.json), cache empty result

Write Request
    │
    ├── Write to GCS bucket
    ├── Update cache with written data (write-through)
    └── On error: invalidate cache for that file
```

**Error Handling:**

- Read errors return empty array `[]` (or `{}` for settings.json) and log to console
- Write errors invalidate the cache and return `false`
- Missing files are treated as empty — no exceptions thrown

---

## 5. Authentication & Authorization

### Password Security

| Parameter | Value |
|-----------|-------|
| **Algorithm** | PBKDF2 |
| **Hash Function** | SHA-512 |
| **Iterations** | 100,000 |
| **Salt Length** | 16 bytes (random) |
| **Hash Length** | 64 bytes |
| **Storage Format** | `salt_hex:hash_hex` |

### Token Generation

| Token Type | Length | Encoding | Purpose |
|------------|--------|----------|---------|
| Session token | 32 bytes | base64url | User authentication |
| RSVP token | 16 bytes | base64url | Invitation responses |

### Authentication Flow

```
1. Client: POST /api/auth/login { email, password }
       │
2. Server: Find user by email (case-insensitive) in users.json
       │
3. Server: Verify password with PBKDF2-SHA512
       │
4. Server: Generate 32-byte session token, store in user record
       │
5. Server: Return { user (sans password_hash), token }
       │
6. Client: Store token in localStorage (cm_token)
           Store user data in localStorage (cm_user)
       │
7. Subsequent requests: Authorization: Bearer {token}
       │
8. Server: Find user where session_token === token
```

### Client-Side Auth (AuthProvider.js)

- Context provides: `{ user, loading, login, logout, checkAuth }`
- Token stored in `localStorage.cm_token`
- User object cached in `localStorage.cm_user`
- Offline fallback: uses cached user if `/api/auth/me` fails
- AppShell redirects to `/` (login) if no user after auth check

---

## 6. User Roles & Permissions

### Role Hierarchy

| Role | Description |
|------|-------------|
| `admin` | Full system access — all features, all data, all users |
| `supervisor` | Team management — sees own org's leads, manages reps |
| `sales_rep` | Personal scope — sees own leads and assigned leads only |

### Feature Access Matrix

| Feature | Admin | Supervisor | Sales Rep |
|---------|-------|------------|-----------|
| Dashboard | Full stats + funnel + scores | Team stats + funnel | Personal stats + funnel |
| Events | CRUD | View/Manage | View |
| Leads | All leads | Org + unassigned | Own + assigned + **unassigned (claimable)** |
| Invited | Send emails + preview | Send emails + preview | View + preview |
| QR Scanner | Yes + **Add Attendee (walk-ins)** | Yes | Yes |
| Check-In Live | Yes (event-wide) | Yes (event-wide + my leads) | Yes (event-wide + my leads) |
| Interactions | All (my + all attendees) | All (my + all attendees) | Own + all attendees |
| Tasks | All | All | Own |
| My Reps | — | Yes | — |
| Reports | Full | Full | Overview + Emails (org-scoped) |
| Users | CRUD | — | — |
| Settings | Full | — | — |
| Audit Log | View | — | — |
| Send Email | Yes | Yes | — |
| Send SMS | Yes | Yes | — |

### Data Visibility Rules

**Leads (GET /api/leads):**
- **Admin:** Sees ALL leads regardless of assignment
- **Supervisor:** Sees unassigned leads + leads assigned to reps in their organization (fuzzy org name matching)
- **Sales Rep:** Sees leads they created (`added_by_user_id`) + leads assigned to them (`assigned_rep_id`) + **unassigned leads (for self-claim)**

**Special scopes (bypass role filter):**
- `?scope=attended` — returns ALL customers with `status='attended'`, optionally filtered by `event_id`. Used by the Interactions page so any user can log interactions with any attendee.
- `?scope=event` — returns ALL customers assigned to the given event (any status, any role). Used by the Check-In Live dashboard to show event-wide progress.

**Sales Rep Self-Claim:** A sales rep can PUT an unassigned lead to set `assigned_rep_id = user.id`, which moves the lead into their org and visibility. The backend enforces this: PUTs from a sales rep are allowed if (a) the lead is owned/assigned to them, OR (b) the lead is unassigned and the update sets `assigned_rep_id` to their own id.

**Organization Matching (Supervisor visibility):**
Fuzzy matching normalizes organization names by:
1. Converting to lowercase
2. Removing suffixes: Inc, Corp, LLC, Ltd, Co
3. Removing punctuation
4. Checking substring containment in both directions

---

## 7. Application Workflows

### 7.1 Lead Lifecycle

```
New Lead (manual entry or CSV/XLSX import)
    │
    ├── Status: "possible" (default)
    │
    ▼
Lead Management (scoring, assignment, notes)
    │
    ├── Bulk status change to "approved"
    │
    ▼
Approved to Invite
    │
    ├── Prepare RSVP Tokens (POST /api/invited)
    │   └── Generates rsvp_token for each approved lead
    │       Status remains "approved"
    │
    ├── Send Email (POST /api/email/send-invites)
    │   └── On successful send: status → "invited"
    │       On failed send: status stays "approved"
    │
    ▼
RSVP Response (POST /api/rsvp)
    │
    ├── Accept → status: "accepted", QR code generated
    │   └── RSVP locked (cannot change after first response)
    │
    ├── Decline → status: "declined", QR code cleared
    │   └── RSVP locked
    │
    ▼
Event Check-In (QR scan or name search)
    │
    └── Status: "attended"
```

### 7.2 Event Selection

1. Dashboard shows event selector (calendar icon, dropdown)
2. If only one active event exists, it auto-selects
3. Selected event stored in `localStorage.cm_event`
4. Content pages (leads, invited, reports, etc.) show "No event selected" banner if no event chosen
5. Dashboard, Events, Settings, Users, and Audit pages are exempt from the banner

### 7.3 Lead Import Workflow

1. User clicks import button → FileImportWizard opens
2. **Step 1 — Upload:** Drag-and-drop or file picker (CSV/XLSX)
3. **Step 2 — Column Mapping:** Map source columns to FunnelFlow fields (full_name, email, phone, company_name, title, notes, source). Multi-column support for name fields
4. **Step 3 — Preview:** Review parsed data in table, sort/filter, select/deselect rows, delete unwanted rows
5. **Step 4 — Import:** Assign to event, submit to `/api/leads/import`
6. API creates customer records with UUIDs, deduplicates by email

### 7.4 Email Sending Workflow

1. Navigate to Invited page → Invited tab
2. Select customers (individual or bulk: "Select All", "Pending RSVP", "Accepted", "Not Yet Invited", "No Reminder Sent")
3. Click "Send Email" → email panel opens
4. Choose email type: invitation, reminder, confirmation, event_update, or custom
5. Warning badge shows if selected type already sent to some recipients
6. Click "Send {type} to {count} recipients"
7. API sends emails sequentially via SMTP, updates status, logs each email
8. Frontend calls `fetchData()` to refresh UI with updated statuses and email badges

---

## 8. API Reference

### Authentication Pattern

All authenticated endpoints follow this pattern:

```javascript
async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}
```

Every request must include: `Authorization: Bearer {session_token}`

### API Endpoints

#### Authentication

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/auth/login` | No | Any | Login with email/password, returns token |
| POST | `/api/auth/register` | No | Any | Register new user account |
| GET | `/api/auth/me` | Yes | Any | Get current user from token |
| POST | `/api/auth/forgot-password` | No | Any | Request password reset; emails reset link (1-hour token) |
| POST | `/api/auth/reset-password` | No | Any | Submit new password with reset token |

#### Team Attendance

Tracks which users (staff) are working each event. Records live in `user_event_attendance.json`, one per `(user_id, event_id)`. Status lifecycle: `pending` → `invited` → `confirmed` / `declined` → `present`.

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET  | `/api/team/attendance` | Yes | Admin/Sup | List attendance records for an event (`?event_id=<id>`) plus the set of users without records ("candidates") |
| POST | `/api/team/attendance` | Yes | Admin/Sup | `action='invite'` adds records with status `pending` and an RSVP token; `action='mark'` manually sets `status` for one record (also mints QR for `confirmed`/`present`); `action='delete'` removes a record |
| GET  | `/api/team/rsvp` | No | Public | Validate token, return event + user summary (no state change — mirrors lead RSVP POST-confirm pattern so email scanners can't trigger false declines) |
| POST | `/api/team/rsvp` | No | Public | Record accept (→ `confirmed`, mint QR) / decline (→ `declined`); locks after first response |
| POST | `/api/team/send` | Yes | Admin/Sup | `kind='invite'` emails the RSVP link; `kind='confirmation'` emails the QR check-in code. Autogenerates RSVP tokens and QR codes as needed. Logs to `email_logs.json` with `type='team_invite'`/`'team_confirmation'` |
| POST | `/api/team/sms` | Yes | Admin/Sup | Sends the RSVP link via Vonage SMS. Requires `phone` on the user and `vonage_api_key`/`vonage_api_secret`/`vonage_from_number` in settings. Stamps `invited_via='sms'` |

#### Events

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/events` | Yes | Any | List all events |
| POST | `/api/events` | Yes | Admin | Create event |
| PUT | `/api/events` | Yes | Admin | Update event |
| DELETE | `/api/events` | Yes | Admin | Delete event |
| GET | `/api/events/ical` | Yes | Any | Export event as .ics file |

#### Leads

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/leads` | Yes | Any | List leads (role-filtered visibility). Sales reps also see unassigned leads. Supports `?event_id=<id>`, `?scope=attended` (all attendees event-wide), `?scope=event` (all event leads regardless of role). |
| POST | `/api/leads` | Yes | Any | Create lead |
| PUT | `/api/leads` | Yes | Any | Update lead (status, scoring, assignment). Sales reps can self-claim an unassigned lead. |
| DELETE | `/api/leads` | Yes | Admin/Sup | Delete lead |
| POST | `/api/leads/import` | Yes | Admin/Sup | Bulk import from CSV/XLSX |
| GET | `/api/leads/duplicates` | Yes | Admin/Sup | Detect duplicates |
| POST | `/api/leads/duplicates` | Yes | Admin/Sup | Merge duplicates |

#### Invitations & RSVP

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/invited` | Yes | Any | List invited customers |
| POST | `/api/invited` | Yes | Admin/Sup | Prepare RSVP tokens |
| GET | `/api/rsvp` | No | Public | Validate RSVP token (status check only) |
| POST | `/api/rsvp` | No | Public | Process RSVP accept/decline |

#### Email

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/email/send-invites` | Yes | Admin/Sup | Send bulk emails to customers |
| POST | `/api/email/send-users` | Yes | Admin | Send notifications to users |
| GET | `/api/email/log` | Yes | Any | Email send log. Scoped to customer visibility: admin sees all, supervisor sees org + unassigned, sales rep sees only their own/assigned. |
| GET | `/api/email/track` | No | Public | Tracking pixel (records opens/clicks) |
| GET | `/api/email/templates` | Yes | Admin/Sup | List email templates |
| POST | `/api/email/templates` | Yes | Admin | Create template |
| PUT | `/api/email/templates` | Yes | Admin | Update template |
| DELETE | `/api/email/templates` | Yes | Admin | Delete template |

#### SMS

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/sms/send` | Yes | Admin/Sup | Send SMS to selected customers |

#### Interactions

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/interactions` | Yes | Any | List interactions |
| POST | `/api/interactions` | Yes | Any | Log new interaction |
| POST | `/api/interactions/upload` | Yes | Any | Upload attachment (images, PDFs) |
| GET | `/api/interactions/attachment` | Yes | Any | Get signed URL for attachment |

#### Tasks

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/tasks` | Yes | Any | List tasks |
| POST | `/api/tasks` | Yes | Any | Create task |
| PUT | `/api/tasks` | Yes | Any | Update task |
| DELETE | `/api/tasks` | Yes | Any | Delete task |

#### Reports

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/reports/stats` | Yes | Any | Pipeline/funnel statistics |
| GET | `/api/reports/post-event` | Yes | Admin/Sup | Post-event report data |
| POST | `/api/reports/post-event` | Yes | Admin/Sup | Generate post-event report |

#### Settings & Users

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/settings` | Yes | Admin | Get app settings |
| POST | `/api/settings` | Yes | Admin | Update app settings |
| GET | `/api/settings/users` | Yes | Admin | List all users |
| POST | `/api/settings/users` | Yes | Admin | Create user |
| PUT | `/api/settings/users` | Yes | Admin | Update user |
| DELETE | `/api/settings/users` | Yes | Admin | Delete user |

#### Other

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/reps` | Yes | Supervisor | List reps in supervisor's org |
| GET | `/api/gcs` | Yes | Admin | List all GCS files |
| GET | `/api/audit` | Yes | Admin | Audit log (last 1000 entries) |

---

## 9. React Components

### AppShell.js — Layout Wrapper

**Props:** `{ children }`

**Behavior:**
- Wraps all authenticated pages with Sidebar
- Checks auth state; redirects to `/` if not logged in
- Displays loading spinner during auth check
- Shows warning banner ("No event selected") on content pages when no event is chosen
- Exempt pages: Dashboard, Events, Settings, Users, Audit
- Mobile: `max-w-full`, `overflow-x-hidden`, `touch-action: pan-y`

### AuthProvider.js — Auth Context

**Exports:** `AuthProvider` component, `useAuth()` hook

**Context Value:** `{ user, loading, login, logout, checkAuth }`

**Storage:**
- `localStorage.cm_token` — session token
- `localStorage.cm_user` — cached user object (JSON)

**Offline Support:** Falls back to cached user if `/api/auth/me` request fails.

### Sidebar.js — Navigation

**Desktop:** Fixed sidebar, collapsible (64px collapsed / 224px expanded). Logo, role-based nav links, user info, guide link, sign out.

**Mobile:** Bottom tab bar with 4 main links + "More" overflow menu (grid layout). Top bar with logo, guide link, sign out.

**Navigation by Role:**

| Role | Links |
|------|-------|
| Admin | Dashboard, Events, Leads, Invited, QR Scanner, Check-In Live, Interactions, Tasks, Reports, Users, Settings, Audit Log |
| Supervisor | Dashboard, Events, Leads, Invited, QR Scanner, Check-In Live, Interactions, Tasks, My Reps, Reports |
| Sales Rep | Dashboard, Leads, Invited, QR Scanner, My Interactions, My Tasks |

**User Guide URLs:**
- Admin: `/admin-guide.html`
- Supervisor: `/supervisor-guide.html`
- Sales Rep: `/sales-rep-guide.html`

### Pagination.js — Reusable Pagination

**Props:** `totalItems`, `page`, `pageSize`, `onPageChange`, `onPageSizeChange`, `pageSizeOptions` (default: [25, 50, 100])

**Features:**
- "X–Y of Z" record count display
- Prev/Next navigation
- Page number buttons (max 7 visible with ellipsis)
- Page size selector dropdown
- Responsive: flex-col on mobile, flex-row on desktop

**Utility Export:** `paginate(arr, page, pageSize)` — slices array for current page.

**Used on:** Leads, Invited, Reports, Audit, Users, Tasks pages.

### FileImportWizard.js — Import Dialog

**Props:** `{ isOpen, onClose, onImport }`

**Steps:**
1. Upload (drag-and-drop or file picker for CSV/XLSX)
2. Column Mapping (map source columns to target fields, multi-select for name)
3. Preview (sortable/filterable table, row selection/deletion)
4. Import (event assignment, submit to API)

---

## 10. Email System

### SMTP Configuration

Stored in `settings.json` (GCS), configured via the app Settings page:

| Setting | Description |
|---------|-------------|
| `smtp_host` | SMTP server hostname (e.g., `smtp.gmail.com`) |
| `smtp_port` | SMTP port (`587` for STARTTLS, `465` for SSL) |
| `smtp_user` | SMTP username (email address) |
| `smtp_pass` | SMTP password or App Password |
| `smtp_from` | From address (can differ from smtp_user) |

**Nodemailer Transport:**
```javascript
nodemailer.createTransport({
  host: settings.smtp_host,
  port: parseInt(settings.smtp_port) || 587,
  secure: parseInt(settings.smtp_port) === 465,  // SSL for port 465, STARTTLS for 587
  auth: { user: settings.smtp_user, pass: settings.smtp_pass },
});
```

**Gmail Note:** Requires a Google App Password (16-character code) with 2-Step Verification enabled on the sending account.

### Email Types

| Type | Subject | Content | RSVP Buttons |
|------|---------|---------|--------------|
| `invitation` | "You're Invited: {event}" | Event details, RSVP buttons | Yes |
| `reminder` | "Reminder: {event} - Please RSVP" | Follow-up for non-respondents | Yes |
| `confirmation` | "Confirmed: {event} - See You There!" | Confirmation with QR code | No |
| `event_update` | "Event Update: {event}" | Updated event details | Yes |
| `custom` | User-provided subject | User-provided body + event block | No |

### Email Tracking

Each sent email includes a 1x1 tracking pixel:
```html
<img src="{appUrl}/api/email/track?type=open&id={logEntryId}" width="1" height="1" style="display:none" />
```

The `/api/email/track` endpoint records opens and clicks in the email log.

### Duplicate Prevention

Within a single send batch, duplicate emails to the same address (case-insensitive) are skipped and counted as `skipped`.

### Status Update Logic

After successful email send:
1. If customer status is `"approved"` → changes to `"invited"`
2. Sets `invited_at` timestamp
3. Sets `invite_sent_at` (first send only)
4. Sets `last_{email_type}_at` timestamp

Failed sends: status remains unchanged, error logged.

---

## 11. SMS Integration

### Vonage (Nexmo) Configuration

Stored in `settings.json`:

| Setting | Description |
|---------|-------------|
| `vonage_api_key` | Vonage API key |
| `vonage_api_secret` | Vonage API secret |
| `vonage_from_number` | Sender phone number |

### Send Flow

1. Admin/Supervisor selects customers and enters message
2. POST `/api/sms/send` with `{ customer_ids, message }`
3. For each customer with a phone number:
   - Clean phone (remove non-digits except leading `+`)
   - POST to `https://rest.nexmo.com/sms/json`
4. Returns `{ sent, failed, errors }`

---

## 12. RSVP & Check-In System

### RSVP Flow

1. **Token Generation:** POST `/api/invited` generates 16-byte base64url RSVP tokens for approved leads
2. **Email Delivery:** Invitation emails contain Accept/Decline buttons linking to `/rsvp?token={token}&action={action}`
3. **RSVP Page:** Public page at `/rsvp` — GET validates token, POST processes response
4. **Anti-Scanner Protection:** GET endpoint returns status only (no state change). RSVP only processes via POST (human click on confirm button). This prevents email security scanners from triggering false declines by pre-fetching links.
5. **Lock After Response:** Once `rsvp_responded_at` is set, subsequent RSVP attempts return the existing response without modification

### QR Code Generation

On RSVP accept:
1. Generate unique 4-character alphanumeric code (charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no ambiguous characters I, O, 0, 1)
2. Verify uniqueness against all existing codes
3. Store as `qr_code_data` on customer record
4. Confirmation email includes QR code image via `api.qrserver.com`

On RSVP decline: `qr_code_data` is cleared to `null`.

### Check-In Methods

**QR Scanner (`/scanner`):**
- Device camera opens with viewfinder
- Uses `jsqr` library to decode QR codes from video frames
- Manual code entry field as fallback
- Successful scan updates status to "attended"

**Name Search:**
- Search by last name on the QR Scanner page
- One-tap check-in without QR code
- Useful for walk-ins or forgotten phones

**Check-In Live Dashboard (`/checkin-dashboard`):**
- Auto-refreshes every 30 seconds
- Shows real-time attendance counts
- Displays recent check-ins

---

## 13. File Attachments

### Upload (POST /api/interactions/upload)

| Parameter | Constraint |
|-----------|-----------|
| **Allowed Types** | JPEG, PNG, GIF, WebP, PDF |
| **Max Size** | 10 MB |
| **Storage Path** | `attachments/{timestamp}_{random}.{ext}` |
| **Access** | Signed URLs (7-day expiry) |

### In-App Camera

Two camera modes accessible from the Interactions page:

1. **Take Photo (blue button):** Opens device camera with viewfinder for photos
2. **Scan Doc (purple button):** Opens camera with document alignment frame + contrast enhancement for document scanning
3. **Attach File:** Standard file picker for existing files

### Signed URL Refresh

GET `/api/interactions/attachment?path={gcs_path}` generates a fresh signed URL for expired attachments.

---

## 14. Reporting & Analytics

### Pipeline/Funnel Dashboard

GET `/api/reports/stats` returns counts by status:
- Leads (total)
- Approved (approved to invite)
- Invited (email sent)
- Declined
- Accepted
- Attended

### Reports Page Features

1. **Overview Report:** Organization tree view with columns: Leads, Approved, Invited, Declined, Attended
2. **Email Log:** Paginated table of all sent emails with status, type, timestamps
3. **Post-Event Report:** Detailed analysis with CSV export capability

---

## 15. Deployment

### Production Infrastructure

| Component | Value |
|-----------|-------|
| **GCP Project** | `corpmarketer-app` (project #678407058536) |
| **Cloud Run Service** | `corpmarketer` |
| **Region** | `us-central1` |
| **Container Image** | `gcr.io/corpmarketer-app/corpmarketer` |
| **GCS Bucket** | `corpmarketer-bucket` |
| **Live URL** | `https://corpmarketer-678407058536.us-central1.run.app` |
| **Min Instances** | 1 (eliminates cold starts) |

### Dockerfile (Multi-Stage Build)

```
Stage 1: deps     — node:20-alpine, npm ci (install dependencies)
Stage 2: builder  — Copy source, npm run build (Next.js build)
Stage 3: runner   — Copy standalone output + static files, run as unprivileged 'nextjs' user
```

**Key details:**
- Alpine Linux base for minimal image size
- `libc6-compat` installed for native modules
- Standalone output mode — no `node_modules` at runtime
- Runs as non-root user (`nextjs`, UID 1001)
- Exposes port 3000

### Deploy Commands

```bash
# 1. Set project
gcloud config set project corpmarketer-app

# 2. Build container (remote, no local Docker needed)
gcloud builds submit --tag gcr.io/corpmarketer-app/corpmarketer --project corpmarketer-app

# 3. Deploy to Cloud Run
gcloud run deploy corpmarketer \
  --image gcr.io/corpmarketer-app/corpmarketer \
  --region us-central1 \
  --project corpmarketer-app \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GCS_BUCKET=corpmarketer-bucket"
```

### Local Development

```bash
npm ci          # Install dependencies
npm run dev     # Start dev server on http://localhost:3000
npm run lint    # Run ESLint
npm run build   # Production build
```

### Version & Backup Process

1. Increment version in `package.json` (patch for fixes, minor for features)
2. Update user guide footers (admin-guide.html, sales-rep-guide.html, supervisor-guide.html)
3. Document new features in user guides
4. `git add` and `git commit` with descriptive message
5. `git tag -a vX.Y.Z`
6. `git push origin main && git push origin vX.Y.Z`
7. Build and deploy if code changed

---

## 16. Troubleshooting

### Check Cloud Run Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=corpmarketer" \
  --project=corpmarketer-app --limit=50 --format="text"
```

### Check Build History

```bash
gcloud builds list --project=corpmarketer-app --limit=5
```

### Check Active Revision

```bash
gcloud run revisions list --service=corpmarketer --region=us-central1 --project=corpmarketer-app --limit=5
```

### Read GCS Data Directly

```bash
gcloud storage cat gs://corpmarketer-bucket/settings.json --project=corpmarketer-app
gcloud storage cat gs://corpmarketer-bucket/customers.json --project=corpmarketer-app
```

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Emails not sending, status not updating | SMTP credentials rejected (535 BadCredentials) | Generate new Google App Password, update in Settings |
| "Email not configured" error | Empty SMTP settings in settings.json | Configure SMTP in app Settings page |
| Login fails but credentials correct | Session token expired or corrupted | Clear localStorage, log in again |
| Leads not visible | Role-based visibility filtering | Admin sees all; supervisor sees org; rep sees own |
| GCS reads return empty data | Bucket permissions or file doesn't exist | Check service account permissions, verify file exists |
| Attachments show broken images | Signed URL expired (7-day TTL) | Reload page — triggers signed URL refresh |
| RSVP links not working | Email scanner triggered false decline | RSVP uses POST-based confirmation to prevent this |
| Build fails on Cloud Run | Dependency or syntax error | Check build logs: `gcloud builds list` |

---

## 17. Data Schema Reference

### users.json

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `email` | string | Login email (case-insensitive matching) |
| `password_hash` | string | PBKDF2-SHA512 hash (`salt:hash` format) |
| `session_token` | string | Active session token (base64url) |
| `full_name` | string | Display name |
| `phone` | string | Phone number |
| `organization_name` | string | Company/org name |
| `organization_id` | string | Org reference ID |
| `role` | string | `admin`, `supervisor`, or `sales_rep` |
| `reset_token` | string | Password-reset token (base64url, 1-hour expiry). Set by `/api/auth/forgot-password`, cleared on successful reset. |
| `reset_token_expires` | string (ISO) | Reset-token expiry timestamp |
| `created_at` | string (ISO) | Account creation timestamp |

### customers.json (Leads)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `full_name` | string | Contact name |
| `title` | string | Job title |
| `company_name` | string | Organization |
| `email` | string | Primary email |
| `alt_email` | string | Alternate email |
| `phone` | string | Phone number |
| `status` | string | `possible`, `approved`, `invited`, `accepted`, `declined`, `attended` |
| `lead_score` | string | `hot`, `warm`, `cold` |
| `source` | string | Lead source |
| `notes` | string | Free-text notes |
| `assigned_rep_id` | string | Assigned sales rep user ID |
| `assigned_rep_name` | string | Assigned rep display name |
| `assigned_rep_org` | string | Assigned rep organization |
| `added_by_user_id` | string | Creator user ID |
| `input_by` | string | Who entered the lead |
| `rsvp_token` | string | RSVP token (base64url) |
| `rsvp_responded_at` | string (ISO) | When RSVP was answered |
| `qr_code_data` | string | 4-char check-in code |
| `invited_at` | string (ISO) | When status changed to invited |
| `invite_sent_at` | string (ISO) | First invitation email timestamp |
| `last_invitation_at` | string (ISO) | Last invitation email |
| `last_reminder_at` | string (ISO) | Last reminder email |
| `last_confirmation_at` | string (ISO) | Last confirmation email |
| `last_event_update_at` | string (ISO) | Last event update email |
| `last_custom_at` | string (ISO) | Last custom email |
| `interaction_count` | number | Total interactions logged |
| `created_at` | string (ISO) | Record creation |
| `updated_at` | string (ISO) | Last modification |

### events.json

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `name` | string | Event name |
| `event_date` | string | Event date |
| `event_time` | string | Event time |
| `location` | string | Venue/address |
| `description` | string | Event description |
| `status` | string | `active`, `inactive` |
| `created_at` | string (ISO) | Creation timestamp |
| `updated_at` | string (ISO) | Last modification |

### event_assignments.json

| Field | Type | Description |
|-------|------|-------------|
| `customer_id` | string | Customer reference |
| `event_id` | string | Event reference |
| `status` | string | Assignment status |
| `created_at` | string (ISO) | Assignment date |

### interactions.json

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `customer_id` | string | Customer reference |
| `user_id` | string | User who logged it |
| `interaction_type` | string | Type (contact, meeting, demo, rsvp_accept, rsvp_decline, etc.) |
| `notes` | string | Interaction notes |
| `attachment_url` | string | GCS signed URL for attached file |
| `attachment_gcs_path` | string | GCS path (e.g., `attachments/123_abc.jpg`) |
| `attachment_filename` | string | Original filename |
| `attachment_content_type` | string | MIME type |
| `created_at` | string (ISO) | Interaction timestamp |

### tasks.json

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `title` | string | Task title |
| `description` | string | Task details |
| `assigned_to` | string/array | User ID(s) assigned |
| `status` | string | Task status |
| `priority` | string | Priority level |
| `due_date` | string | Due date |
| `created_by` | string | Creator user ID |
| `created_at` | string (ISO) | Creation timestamp |
| `updated_at` | string (ISO) | Last modification |

### email_logs.json

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier (used for tracking) |
| `direction` | string | `outbound` |
| `type` | string | Email type (invitation, reminder, etc.) |
| `from` | string | Sender address |
| `to` | string | Recipient address |
| `subject` | string | Email subject |
| `html_body` | string | Full HTML content |
| `customer_id` | string | Customer reference |
| `customer_name` | string | Customer display name |
| `event_id` | string | Event reference |
| `event_name` | string | Event display name |
| `sent_by` | string | User who triggered send |
| `status` | string | `sent` or `failed` |
| `error` | string | Error message (if failed) |
| `opened_at` | string (ISO) | When tracking pixel was loaded |
| `clicked_at` | string (ISO) | When a link was clicked |
| `created_at` | string (ISO) | Send timestamp |

### settings.json

| Field | Type | Description |
|-------|------|-------------|
| `company_name` | string | Organization display name |
| `company_logo_url` | string | Logo URL for emails and UI |
| `app_url` | string | Public app URL |
| `smtp_host` | string | SMTP server hostname |
| `smtp_port` | string | SMTP port |
| `smtp_user` | string | SMTP username |
| `smtp_pass` | string | SMTP password/App Password |
| `smtp_from` | string | From email address |
| `vonage_api_key` | string | Vonage SMS API key |
| `vonage_api_secret` | string | Vonage SMS API secret |
| `vonage_from_number` | string | SMS sender number |
| `updated_at` | string (ISO) | Last settings update |

### user_event_attendance.json

One record per `(user_id, event_id)` pair — tracks which team members are working each event.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `user_id` | string | FK to `users.json` |
| `event_id` | string | FK to `events.json` |
| `status` | string | `pending`, `invited`, `confirmed`, `declined`, `present` |
| `rsvp_token` | string (base64url) | Generated on invite create; used by `/team-rsvp` |
| `qr_code_data` | string | 4-char check-in code (shares namespace with customer QR codes) |
| `rsvp_sent_at` | string (ISO) | When invite email or SMS was sent |
| `rsvp_responded_at` | string (ISO) | When user clicked accept or decline |
| `confirmation_sent_at` | string (ISO) | When the QR confirmation email was sent |
| `checkin_at` | string (ISO) | When scanned in at the event (status → present) |
| `invited_via` | string | `email`, `sms`, or empty |
| `notes` | string | Admin notes |
| `created_at` | string (ISO) | |
| `updated_at` | string (ISO) | |

### audit_log.json

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier |
| `user_id` | string | User who performed action |
| `user_name` | string | User display name |
| `action` | string | Action performed |
| `entity_type` | string | Type of entity affected |
| `entity_id` | string | ID of entity affected |
| `details` | string | Action details |
| `created_at` | string (ISO) | Action timestamp |

**Auto-cleanup:** Oldest entries are removed when log exceeds 1000 entries.
