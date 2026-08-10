# Quizly Quiz Platform

A full-stack quiz management platform built with React, Express, SQLite, JWT, and bcrypt. It includes a responsive dashboard plus authenticated quiz, attempt, scoring, analytics, and leaderboard APIs.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

Run the API separately with `npm run server`, or run both with `npm run dev:full`.

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

The API is ready for frontend integration. The remaining production task is deploying the frontend/API and configuring a hosted SQLite-compatible database or managed relational database with a strong `JWT_SECRET`.
