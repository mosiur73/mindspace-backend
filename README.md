# MindSpace — AI-Powered Mental Health Platform

> A full-stack SaaS platform connecting users with licensed therapists, powered by Google Gemini AI for personalized mental wellness support.

---

## Features

### For Users
- **AI Wellness Chatbot** — Conversational AI (Gemini) with crisis protocol, 10-message context window, quick suggestions
- **Journal Analyzer** — Write mood journals; AI generates sentiment, tone, themes, and personalized advice
- **Mood Pattern Analyzer** — Daily emoji mood check-ins; AI detects trends, triggers, and best days
- **Therapist Recommender** — AI matches therapists based on mood history and selected concerns with match scores
- **Session Booking** — Browse therapists, pick available time slots, book online or in-person sessions
- **Review System** — Rate and review therapists after completed sessions (1–5 stars + comment)
- **Subscription Management** — Upgrade to Pro or Premium via SSLCommerz payment gateway
- **Real-time Notifications** — Instant bell updates via Socket.io (no page refresh needed)
- **Dashboard** — Overview stats, mood charts, session history, streak tracking, upcoming sessions

### For Therapists
- **Availability Slots** — Set weekly schedule (days, hours, slot duration); users see only open slots when booking
- **Appointment Management** — Confirm, complete, or cancel client appointments with real-time client notification
- **Session Notes** — Write private notes for completed sessions, visible to client
- **Client Overview** — All clients with total sessions and last session date
- **Earnings Tracker** — Monthly earnings area chart, full transaction history
- **Profile Editor** — Specialties, certifications, languages, pricing, bio, approach

### For Admins
- **Platform Analytics** — User growth (12 months), session trends, revenue overview, recent activity feed
- **User Management** — Search, filter by role/plan, ban/unban users
- **Therapist Verification** — Review and verify/reject therapist applications
- **AI Blog Generator** — Generate blog posts with Gemini AI (topic + category → full article)
- **Blog Management** — Full CRUD, publish/unpublish, edit inline
- **Subscription Management** — All subscriptions with revenue aggregation
- **Newsletter Subscribers** — View all newsletter sign-ups from landing page

### Technical Highlights
- **Google Gemini 1.5 Flash** — 4 AI features, graceful mock fallback when API key not set
- **Socket.io** — Real-time notifications pushed to connected dashboard clients
- **SSLCommerz** — Payment gateway with bKash, Nagad, cards (sandbox-ready)
- **Nodemailer** — HTML email templates for session events (booked, confirmed, cancelled, completed, reminder)
- **node-cron** — Hourly job sends reminder emails 24h before sessions
- **BullMQ + Redis** — Async email queue (degrades to sync without Redis)
- **In-memory cache** — TTL-based caching for therapist lists, stats, specialties (Redis-ready)
- **Sentry** — Optional 5xx error tracking with user + route context
- **Rate limiting** — Global (100/min), auth (20/min), AI (10/min)
- **Role-based access** — USER / THERAPIST / ADMIN with route guards
- **Full dark mode** — CSS variables, system preference aware
- **Responsive** — Mobile-first, works on all screen sizes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth v4 — Credentials + Google OAuth |
| State | TanStack Query v5, Zustand |
| Charts | Recharts (Line, Bar, Area, Pie) |
| Animations | Framer Motion |
| Real-time | Socket.io |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| AI | Google Gemini 1.5 Flash |
| Payment | SSLCommerz (bKash, Nagad, cards) |
| Email | Nodemailer + BullMQ queue |
| Scheduler | node-cron |
| Image Upload | Cloudinary |
| Error Tracking | Sentry (optional) |
| Logging | Winston |

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- (Optional) Redis — for BullMQ email queue
- (Optional) Google Gemini API key — for real AI responses
- (Optional) Google OAuth credentials — for social login
- (Optional) Gmail App Password — for sending emails
- (Optional) Cloudinary account — for image uploads (avatar, therapist photos, blog covers)

---

### 1. Clone the repo

```bash
git https://github.com/mosiur73/mindspace-backend
cd mindspace-backend
```

---

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
```

Fill in `backend/.env`:

```env
# Required
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/mindspace"
JWT_SECRET="your-super-secret-jwt-key"
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:5000"

# AI — get free key at https://aistudio.google.com
GEMINI_API_KEY=""

# Payment — sandbox works out of the box
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
SSLCOMMERZ_IS_LIVE=false

# Email — Gmail: enable App Passwords in Google Account settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional
REDIS_URL="redis://localhost:6379"
SENTRY_DSN=""
```

```bash
npm install
npx prisma db push          # sync DB schema
npm run db:seed             # seed demo accounts + therapists
npm run dev                 # starts on http://localhost:5000
```

---

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
```

Fill in `frontend/.env.local`:

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
BACKEND_URL="http://localhost:5000"

# Optional — Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

```bash
npm install
npm run dev             # starts on http://localhost:3000
```

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| User | user@mindspace.com | User@123456 |
| Therapist | therapist@mindspace.com | Therapist@123456 |
| Admin | admin@mindspace.com | Admin@123456 |

---

## AI Features

All 4 AI features work **without a Gemini API key** using realistic mock responses.  
To enable real AI: add `GEMINI_API_KEY=your-key` to `backend/.env` and restart.

| Feature | Endpoint | Description |
|---|---|---|
| Wellness Chatbot | `POST /api/ai/chat` | Context-aware conversation with crisis protocol |
| Therapist Recommender | `POST /api/ai/recommend` | Match therapists by mood history + concerns |
| Journal Analyzer | `POST /api/journals/:id/analyze` | Sentiment, tone, themes, advice |
| Mood Pattern Analyzer | `POST /api/moods/analyze` | Trend detection, triggers, recommendations |

---

## Payment — SSLCommerz

| Mode | Config | Cards |
|---|---|---|
| Sandbox (default) | `SSLCOMMERZ_IS_LIVE=false` | Card: `4111 1111 1111 1111` · OTP: `123456` |
| Live | `SSLCOMMERZ_IS_LIVE=true` | Real bKash, Nagad, Visa, Mastercard |

**Plans:**
| Plan | Price | Features |
|---|---|---|
| Free | ৳0 | Mood tracking, journal, 5 AI chats/day |
| Pro | ৳2,900/month | Unlimited AI, 4 sessions/month credit |
| Premium | ৳7,900/month | Everything + 8 sessions, family account |

---

## Email

Emails are sent via SMTP (Nodemailer). If `SMTP_USER` / `SMTP_PASS` are not set, emails are silently skipped (warning logged).

| Template | Trigger |
|---|---|
| `session_booked` | User books a session |
| `session_confirmed` | Therapist confirms |
| `session_cancelled` | Session cancelled |
| `session_completed` | Session marked complete |
| `session_reminder` | 24h before session (cron) |
| `welcome` | New user registration |

---

## Real-time Notifications

Socket.io is used for instant notifications without polling:
- User connects with their JWT token → joins `user:{id}` room
- On session booking, confirmation, or status change → `emitNotification()` pushes to that room
- DashboardHeader listens → invalidates queries → bell badge updates instantly

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/oauth` | Google OAuth |
| GET | `/api/auth/me` | Current user |

### Therapists
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/therapists` | List (search, filter, sort, paginate) |
| GET | `/api/therapists/specialties` | Unique specialties list |
| GET | `/api/therapists/:id` | Full profile |
| GET | `/api/therapists/:id/reviews` | Paginated reviews |
| GET | `/api/therapists/:id/related` | Related therapists |
| GET | `/api/therapists/:id/slots?date=` | Available time slots for a date |

### Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions` | Book a session |
| GET | `/api/sessions` | User's sessions (paginated) |
| PATCH | `/api/sessions/:id/cancel` | Cancel session |

### User
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/stats` | Dashboard stats + unread count |
| PATCH | `/api/users/profile` | Update profile |
| PATCH | `/api/users/password` | Change password |
| GET | `/api/users/notifications` | Notification list |
| PATCH | `/api/users/notifications/read` | Mark all as read |
| POST | `/api/users/upload-avatar` | Upload avatar photo (Cloudinary) |

### Journal
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/journals` | List journals |
| POST | `/api/journals` | Create journal |
| PUT | `/api/journals/:id` | Update journal |
| DELETE | `/api/journals/:id` | Delete journal |
| POST | `/api/journals/:id/analyze` | AI analysis |

### Mood
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/moods` | Log mood |
| GET | `/api/moods` | Mood history |
| GET | `/api/moods/today` | Today's log |
| POST | `/api/moods/analyze` | AI pattern analysis |

### AI
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ai/chat` | Chat history (last 20) |
| POST | `/api/ai/chat` | Send message |
| DELETE | `/api/ai/chat` | Clear history |
| POST | `/api/ai/recommend` | Therapist recommendations |

### Reviews
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reviews` | Submit review (completed sessions only) |
| GET | `/api/reviews/check?therapistId=` | Check if already reviewed |

### Subscriptions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/subscriptions/initiate` | Start SSLCommerz payment |
| GET | `/api/subscriptions/status` | Current subscription |
| POST | `/api/subscriptions/ipn/success` | SSLCommerz success callback |

### Newsletter
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/newsletter/subscribe` | Subscribe email |
| GET | `/api/newsletter` | List subscribers (admin only) |

### Therapist Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/therapist-dashboard/stats` | Earnings, sessions, chart data |
| GET | `/api/therapist-dashboard/appointments` | Appointments (filtered) |
| PATCH | `/api/therapist-dashboard/appointments/:id/status` | Update status |
| PATCH | `/api/therapist-dashboard/appointments/:id/notes` | Save session notes |
| GET | `/api/therapist-dashboard/clients` | All clients |
| GET | `/api/therapist-dashboard/earnings` | Earnings + history |
| GET | `/api/therapist-dashboard/availability` | Weekly availability |
| PUT | `/api/therapist-dashboard/availability` | Save availability |
| GET | `/api/therapist-dashboard/profile` | Profile |
| PATCH | `/api/therapist-dashboard/profile` | Update profile |
| POST | `/api/therapist-dashboard/upload-image` | Upload profile photo (Cloudinary) |
| DELETE | `/api/therapist-dashboard/images` | Remove a profile photo |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform-wide stats |
| GET | `/api/admin/users` | All users (search, filter) |
| PATCH | `/api/admin/users/:id/ban` | Ban/unban user |
| GET | `/api/admin/therapists` | All therapists |
| PATCH | `/api/admin/therapists/:id/verify` | Verify/reject |
| GET/POST | `/api/admin/blogs` | Blog list / create |
| PATCH/DELETE | `/api/admin/blogs/:id` | Update / delete blog |
| POST | `/api/admin/blogs/generate` | AI blog generation |
| POST | `/api/admin/blogs/upload-cover` | Upload blog cover image (Cloudinary) |
| GET | `/api/admin/blogs/public` | Published blogs (public) |
| GET | `/api/admin/subscriptions` | All subscriptions |

---

## Project Structure

```
mindspace/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 14 models
│   │   └── seed.ts
│   └── src/
│       ├── controllers/           # 12 controllers
│       ├── services/              # ai.service, email.service, socket.service
│       ├── middleware/            # auth, error, rateLimit, validate
│       ├── jobs/                  # email.queue (BullMQ), reminder.job (cron)
│       ├── routes/                # 13 route files
│       ├── utils/                 # cache, jwt, logger, apiResponse
│       ├── types/                 # express.d.ts, sslcommerz-lts.d.ts
│       ├── lib/                   # prisma client
│       ├── app.ts
│       └── server.ts              # HTTP + Socket.io + cron init
│
└── frontend/
    ├── app/
    │   ├── (auth)/                # Login, Register
    │   ├── (public)/
    │   │   ├── therapists/        # Listing + [id] detail
    │   │   └── blog/              # Blog listing + [id] reading page
    │   ├── dashboard/
    │   │   ├── user/              # Overview, Sessions, Journal, Mood,
    │   │   │                      # AI (Chat + Recommend), Subscription, Profile
    │   │   ├── therapist/         # Overview, Appointments, Clients,
    │   │   │                      # Earnings, Availability, Profile
    │   │   └── admin/             # Overview, Users, Therapists,
    │   │                          # Subscriptions, Blogs, Reports, Settings
    │   ├── payment/               # success, fail, cancel pages
    │   └── not-found.tsx          # Custom 404 page
    ├── components/
    │   ├── ui/                    # Button, Input, Card, Skeleton, Badge
    │   ├── shared/                # Navbar, Footer, Providers
    │   ├── home/                  # 10 landing page sections
    │   ├── therapists/            # TherapistCard, Filters, BookingModal
    │   └── dashboard/             # DashboardHeader, Sidebars, Charts
    ├── lib/                       # api.ts, auth.ts, utils.ts, socket.ts
    ├── store/                     # Zustand auth store
    └── types/                     # TypeScript types, next-auth.d.ts
```

---

## Database Schema

**14 tables:**

| Table | Description |
|---|---|
| `users` | All users (role: USER/THERAPIST/ADMIN) |
| `accounts` | OAuth provider accounts |
| `therapists` | Therapist profiles linked to users |
| `therapist_availability` | Weekly availability slots per therapist |
| `sessions` | Booked therapy sessions |
| `journals` | User mood journals with AI analysis |
| `mood_logs` | Daily mood score check-ins |
| `reviews` | User reviews for therapists |
| `subscriptions` | Active plan subscriptions |
| `blogs` | Admin-created blog posts |
| `notifications` | In-app notifications |
| `chat_messages` | AI chatbot message history |
| `newsletters` | Newsletter subscriber emails |
| `earnings` | Therapist session earnings |

---

## Build for Production

```bash
# Backend
cd backend
npm run build       # TypeScript → dist/
npm start           # node dist/server.js

# Frontend
cd frontend
npm run build       # Next.js optimized build
npm start           # production server
```

---

## Rate Limits

| Scope | Limit |
|---|---|
| Global | 100 requests / minute |
| Auth endpoints | 20 requests / minute |
| AI endpoints | 10 requests / minute |

---

## Environment Variables Summary

### Backend (`backend/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS |
| `BACKEND_URL` | ✅ | Backend URL for SSLCommerz callbacks |
| `GEMINI_API_KEY` | Optional | Google AI Studio key |
| `SSLCOMMERZ_STORE_ID` | Optional | Default: `testbox` (sandbox) |
| `SSLCOMMERZ_STORE_PASSWORD` | Optional | Default: `qwerty` (sandbox) |
| `SSLCOMMERZ_IS_LIVE` | Optional | `false` for sandbox |
| `SMTP_HOST` | Optional | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_USER` | Optional | Email sender address |
| `SMTP_PASS` | Optional | Email app password |
| `REDIS_URL` | Optional | Redis for BullMQ |
| `SENTRY_DSN` | Optional | Sentry error tracking |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary image upload |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary image upload |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary image upload |

### Frontend (`frontend/.env.local`)
| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | ✅ | App URL |
| `NEXTAUTH_SECRET` | ✅ | Session encryption key |
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |
| `BACKEND_URL` | ✅ | Backend URL (server-side) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |

---

## License

MIT
