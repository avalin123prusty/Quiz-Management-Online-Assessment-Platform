# Quizly Quiz Platform

A full-stack quiz management platform built with React, Express, SQLite, JWT, and bcrypt. It includes a responsive dashboard plus authenticated quiz, attempt, scoring, analytics, and leaderboard APIs.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

The repository is organized into `frontend/` and `backend/`. Run the API separately with `npm run server`, or run both with `npm run dev:full`.

Demo accounts: `student@quizly.local` / `Student123!` and `admin@quizly.local` / `Admin123!`.

## Day-wise delivery

- **Day 1:** React/Vite project setup, environment-ready npm scripts, responsive app shell.
- **Day 2:** SQLite schema, seeded accounts, registration, login, bcrypt password hashing, and JWT sessions.
- **Day 3:** Auth middleware and admin/student authorization guards.
- **Day 4:** Student dashboard, statistics, navigation, and leaderboard panels.
- **Day 5:** Quiz library cards and quiz detail entry flow.
- **Day 6:** Quiz metadata, progress, categories, and question preview foundation.
- **Day 7:** Quiz launch surface with timing and progress context.
- **Day 8:** Attempt creation, answer submission, automatic scoring, and 60% pass/fail calculation.
- **Day 9:** Results and attempt history endpoints.
- **Day 10:** Student completion and average-score analytics.
- **Day 11:** Admin student, quiz, attempt, and pass-rate analytics.
- **Day 12:** Overall leaderboard endpoint.
- **Day 13:** API tests for health, auth, authorization, and protected quiz listing.
- **Day 14:** Production build, environment-ready configuration, and this documentation.

## Current scope

The API is ready for frontend integration. Covered endpoint groups include authentication lifecycle, admin users, categories, quizzes, questions, student attempts/results, admin attempts/analytics, and leaderboard.

Advanced features currently covered: randomized question and option order, negative marking, maximum attempts, quiz availability windows, pass-gated certificate metadata, and a frontend dark-mode toggle.

Security controls include bcrypt hashing, JWT verification, role middleware, suspended-account checks, parameterized SQL, request validation, Helmet security headers, auth rate limiting, bounded JSON input, and generic authentication/reset errors. The frontend never supplies correct answers or scores; scoring is calculated in the API.

## API endpoint groups

- `/api/auth/*`: register, login, logout, forgot-password, reset-password, and current user.
- `/api/users/*`: admin-only user listing, detail, update, deletion, and status changes.
- `/api/categories/*`: admin-only category CRUD.
- `/api/quizzes/*`: published listing/detail, admin CRUD, publishing, question CRUD, quiz start, and submission.
- `/api/attempts/*`: student history, detail, certificate metadata, and admin result views.
- `/api/analytics/*` and `/api/leaderboard`: student/admin performance metrics and rankings.

The remaining production work is deployment, hosted database configuration, email delivery for reset/results/certificates, and browser-level responsive/API integration tests. CSV/XLSX question import and real PDF certificate rendering are also future extensions.

## Deploy on Render

The included `render.yaml` creates the API and frontend services. Because this project uses SQLite, the API uses a 1 GB persistent disk at `/var/data/quizly.db`. Do not use an ephemeral filesystem for production data.

1. Push the repository to GitHub.
2. Open Render and choose **New > Blueprint**.
3. Select `avalin123prusty/Quiz-Management-Online-Assessment-Platform` and branch `main`.
4. Apply the blueprint from `render.yaml`.
5. After the first deploy, open the frontend service URL and set the API URL in frontend integration code to the API service URL if API calls are added there.

Manual service settings, if you do not use the blueprint:

- Backend root directory: repository root
- Backend build command: `npm ci`
- Backend start command: `npm run server`
- Backend health check: `/api/health`
- Frontend build command: `npm ci && npm run build`
- Frontend publish directory: `frontend/dist`
- Backend variables: `NODE_ENV=production`, a long random `JWT_SECRET`, `DATABASE_PATH=/var/data/quizly.db`, and `CORS_ORIGIN=https://YOUR-FRONTEND.onrender.com`

Local production check:

```powershell
npm ci
npm test
npm run build
npm run server
```

In another terminal:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Expected response:

```json
{"status":"ok"}
```
