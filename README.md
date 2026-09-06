# 📬 ReachInbox - High-Throughput Email Job Scheduler & Dispatch Engine

A distributed, production-ready email scheduling and queue processing engine built with **Node.js**, **TypeScript**, **BullMQ**, **Redis**, **PostgreSQL (Prisma)**, and **React (Vite)**. Designed for scale, deliverability protection, and real-time observability.

---

## 🌟 Key Capabilities

- **🔐 Google OAuth 2.0 Authentication**: Secure, session-based authentication with Google Single Sign-On (Passport.js + Express Session).
- **⚡ Distributed Queue Architecture**: Powered by **BullMQ** with multi-worker concurrency (5 parallel threads) and persistent queue management.
- **🛡️ Intelligent Rate Limiter & Token Bucket**:
  - Enforces a minimum **2,000ms delay** between consecutive dispatches.
  - Strict **hourly sender rate limits (200 emails/hr)** backed by atomic Redis counters.
  - Automatic intelligent backoff and rescheduling for delayed jobs when quota limits are reached.
- **📊 Native Live Engine Telemetry Dashboard**:
  - Embedded real-time BullMQ telemetry monitoring **Active, Delayed, Waiting, Delivered, and Failed** jobs.
  - Live Job Inspector table with payload details, delay intervals, attempt history, and error logs.
  - One-click actions for **Retrying Failed Jobs** and **Purging Redis History**.
- **🔍 Full-Text Email Search**: Sub-millisecond search across recipient leads, subject lines, and body content powered by **Elasticsearch** (with fallback database search).
- **💬 Real-Time Slack Integration**: OAuth-connected Slack notifications for hourly sender rate-limit alerts and dispatch milestones.
- **🎨 Modern ReachInbox UI**: Clean, responsive, dark/light balanced interface built with **React**, **Vite**, **Tailwind CSS**, and **Lucide Icons**.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React 18 Frontend                      │
│            (Vite + Tailwind CSS + Lucide Icons)             │
└──────────────────────────────┬──────────────────────────────┘
                               │  REST API / Session Cookies
┌──────────────────────────────▼──────────────────────────────┐
│                    Express.js Backend API                   │
│   • Google OAuth 2.0 (Passport.js)                          │
│   • Email Composer & Batch Ingestion                        │
│   • BullMQ Queue Dispatcher                                 │
│   • Elasticsearch Full-Text Search Service                  │
│   • Slack OAuth Webhook Notifier                            │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
    ┌──────────▼──────────┐        ┌──────────▼──────────┐
    │  PostgreSQL (Neon)  │        │   Redis (Upstash)   │
    │  • User Profiles    │        │  • BullMQ Queues    │
    │  • Email Metadata   │        │  • Token Buckets    │
    │  • Dispatch Logs    │        │  • Hourly Counters  │
    └─────────────────────┘        └──────────┬──────────┘
                                              │
                                   ┌──────────▼──────────┐
                                   │ BullMQ Worker Node  │
                                   │ • 5 Parallel Threads│
                                   │ • 2000ms Delay Gate │
                                   │ • 200/hr Limiter    │
                                   │ • Ethereal / SMTP   │
                                   └─────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: `v18.x` or `v20.x`
- **npm**: `v9.x` or higher
- **PostgreSQL Database** (e.g. Neon, Supabase, or local Docker)
- **Redis Server** (e.g. Upstash or local Redis 7)

---

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Suhas-git-25/Email_scheduler.git
cd Email_scheduler

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
cd ..
```

---

### 2. Configure Environment Variables

#### Backend (`backend/.env`)
Copy the example file:
```bash
cp backend/.env.example backend/.env
```
Fill in the following variables:
```ini
DATABASE_URL=postgresql://user:password@localhost:5432/email_scheduler?sslmode=require
REDIS_URL=rediss://default:password@your-redis-host:6379
PORT=4000
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# Google OAuth Credentials (Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=your-secure-session-secret

# Ethereal / SMTP Credentials
ETHEREAL_USER=your-ethereal-user
ETHEREAL_PASS=your-ethereal-password

# Elasticsearch (Optional)
ELASTICSEARCH_URL=https://your-elastic-instance:443
ELASTICSEARCH_API_KEY=your-elastic-api-key

# Slack Integration (Optional)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

# Queue & Worker Settings
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
ADMIN_DASHBOARD_TOKEN=admin-reachinbox-secret-token
```

#### Frontend (`frontend/.env`)
```bash
cp frontend/.env.example frontend/.env
```
```ini
VITE_API_URL=http://localhost:4000
```

---

### 3. Database Migration

```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

---

### 4. Running the Application

You can start the backend API server, the BullMQ background worker daemon, and the Vite frontend simultaneously:

#### Terminal 1 — Backend API
```bash
cd backend
npm run dev
```

#### Terminal 2 — BullMQ Worker Daemon
```bash
cd backend
npm run worker
```

#### Terminal 3 — Frontend UI
```bash
cd frontend
npm run dev
```

- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000`
- **Raw Bull Board**: `http://localhost:4000/admin/queues?token=admin-reachinbox-secret-token`

---

## 🧪 Testing & Observability

### BullMQ Real-Time Telemetry
Navigate to the **Live Queues** tab in the sidebar to inspect:
- Multi-worker parallel processing states
- Delayed timestamp scheduling windows
- Rate limiter status & atomic hourly quotas
- In-memory BullMQ job payloads and failure logs

---

## 🛠️ Tech Stack

| Domain | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React |
| **Backend API** | Node.js, Express, TypeScript, Passport.js, Express Session |
| **Queue Engine** | BullMQ, Redis (Upstash / Redis 7) |
| **Database & ORM** | PostgreSQL (Neon), Prisma ORM |
| **Search Engine** | Elasticsearch 8 |
| **Email Transport** | Nodemailer, Ethereal Test SMTP |
| **Notifications** | Slack OAuth 2.0 Webhook Client |

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
