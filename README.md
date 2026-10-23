

Uploading intro.mp4…

# Qbot (demo)

Describe a browser task in plain English. Groq AI turns it into steps, Playwright (JavaScript) runs them,
and you choose whether the browser runs headless or opens a visible window.

```
frontend/   flat UI: login, signup, dashboard, new job, live log
backend/    FastAPI: auth (JWT + SQLite), jobs, Groq AI planning, job runner
runner/     Node + Playwright: executes the JSON plan
```

## Setup (about 3 minutes)

Requires Python 3.10+ and Node 18+.

```bash
# 1. Config
cp .env.example .env          # add your GROQ_API_KEY (free key: console.groq.com)

# 2. Runner (Playwright)
cd runner
npm install
npx playwright install chromium
cd ..

# 3. Backend
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000, sign up, click **New job**, then **Start job**.

## How it works

1. You write the task. `POST /api/jobs` sends it to Groq, which returns a JSON plan of whitelisted steps
   (`goto`, `click`, `fill`, `press`, `wait`, `waitForSelector`, `scroll`, `title`, `extract`, `verify`, `screenshot`).
2. **Start job** calls `POST /api/jobs/{id}/run` with `headless: true|false`. FastAPI spawns
   `node runner/runner.js`, streams its output into the job log, and the UI polls every 1.2 s.
3. Headless off opens a real Chromium window (slowed down so you can follow it). Headless on runs silently.
   Either way you get the log, extracted data and a final screenshot.

Without a `GROQ_API_KEY` the app still works using a sample plan (Hacker News headlines).

## Demo limits (not production)

- The visible browser opens on the machine running the server, so use it locally.
- Groq AI never writes code. It only picks from the allowed step list, and the runner rejects anything else.
- Jobs run one process each with no queue, quotas or sandboxing.
- Auth is basic: PBKDF2 passwords, JWT in localStorage. Set a real `JWT_SECRET`.
- No handling for CAPTCHAs, logins on target sites, or heavy single-page apps.
