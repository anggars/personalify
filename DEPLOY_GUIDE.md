# Deploying Personalify to Vercel

Since we have a **Monorepo** structure (Frontend in `frontend/`, Backend in root/`api/`), we need a specific Vercel configuration.

## 1. Project Structure
- **Root (`.`):** Contains `api/` (Python Backend) and `package.json` (Build Orchestration).
- **`frontend/`:** Contains Next.js application.
- **`backend/`:** Python source code (imported by `api/`).

## 2. Vercel Configuration (`vercel.json`)
I have already updated `vercel.json` to:
- **Rewrite** `/api/*` to our Python backend (`api/index.py`).
- **Rewrite** `/login` and `/callback` to Python (for Spotify Auth).
- **Output Directory:** Point to `frontend/.next` (since Next.js is in a subfolder).

## 3. Deployment Steps
1.  **Push to GitHub:** Ensure all changes (including the rename to `frontend`) are pushed.
2.  **Import in Vercel:**
    - Import the repository.
    - **Framework Preset:** `Next.js` (Usually auto-detected, or select it).
    - **Root Directory:** Leave as `.` (Project Root). **DO NOT** change this to `frontend`.
        - *Reason:* If you change it to `frontend`, the Python backend files (`backend/`, `api/`) will be inaccessible.
3.  **Build Settings:**
    - **Build Command:** `cd frontend && pnpm install && pnpm run build`
        - *Reason:* We need to tell Vercel to go into the frontend folder and build Next.js.
        - *Note:* I updated `package.json` in the root to include this script. You can simply use `npm run build` as the Override command, or let Vercel use the default if it picks up the root package.json.
        - **Recommendation:** In Vercel Project Settings > General > Build & Development Settings:
            - **Build Command:** `OVERRIDE` -> `cd frontend && pnpm install && pnpm run build`
            - **Output Directory:** `OVERRIDE` -> `frontend/.next` (If not picked up from vercel.json).
4.  **Environment Variables:**
    Copy your `.env` variables to Vercel Project Settings > Environment Variables.
    Required:
    - `SPOTIFY_CLIENT_ID`
    - `SPOTIFY_CLIENT_SECRET`
    - `SPOTIFY_REDIRECT_URI` (Set to `https://your-vercel-domain.app/callback`)
    - `SPOTIFY_REDIRECT_URI_VERCEL` (Same as above)
    - `MONGODB_URI`
    - `REDIS_URL`

## 4. Verification
- **Frontend:** Should load at `https://your-domain.app`.
- **Backend:** `https://your-domain.app/api/` should return `{"status": "ok"}`.
