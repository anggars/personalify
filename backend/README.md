# Personalify Backend API

The backend for Personalify is a high-performance **FastAPI** (Python)
application that orchestrates the core data pipeline, authentication, and
AI-driven analysis.

## Core Responsibilities

- **Dual-Provider Sync**: Manages data pipelines for both **Spotify** (OAuth2) and **Last.fm** (Public Username).
- **QStash Job Queue**: Handles asynchronous background tasks for data enhancement and AI analysis on Vercel.
- **AI Intelligence**: Performs deep emotion and MBTI analysis on tracks using a hybrid NLP approach (Hugging Face).
- **Metadata Scraper**: Fallback scrapers for Last.fm tracks/artists when Spotify metadata is unavailable.

## System Architecture & Handlers

The backend follows a modular architecture where each handler manages a specific
domain:

- **`lastfm_handler.py`**: The bridge for Last.fm integration. Handles public profile scraping, track/artist image resolution, and metadata enhancement.
- **`qstash_handler.py`**: Manages communication with Upstash QStash for reliable serverless background job triggering.
- **`spotify_handler.py`**: Handles Spotify OAuth2, recursive syncing, and metadata enrichment for both providers.
- **`nlp_handler.py`**: The AI core. Includes **MBTI Personality Detection** and emotion analysis via custom models.
- **`cache_handler.py`**: High-speed caching using **Redis/Upstash** for dashboard and image data.

## API Endpoints

### Authentication & Access

| Method | Endpoint          | Description                                                         |
| :----- | :---------------- | :------------------------------------------------------------------ |
| `GET`  | `/login`          | Starts Spotify OAuth2 flow. Optional `mobile=true` for app-linking. |
| `GET`  | `/callback`       | Exchange code for token and initializes user profiling.             |
| `GET`  | `/api/me`         | Get current user's Spotify ID from cookies.                         |
| `POST` | `/auth/refresh`   | Refresh access tokens (Supports JSON body for Mobile).              |
| `POST` | `/request-access` | Captures access requests for the private beta.                      |
| `GET`  | `/logout`         | Invalidates session and clears cookies.                             |

### Synchronization & Analysis

| Method | Endpoint                       | Description                                                 |
| :----- | :----------------------------- | :---------------------------------------------------------- |
| `GET`  | `/sync/top-data`               | Synchronizes Top Spotify data into the persistent database. |
| `GET`  | `/sync/lastfm-user`            | Fast-sync user data from Last.fm Username.                  |
| `POST` | `/api/tasks/lastfm-enhancement`| **Worker**. Background QStash task for Last.fm enhancement. |
| `POST` | `/analyze-emotions-background` | Queues background emotion analysis for tracks.              |

### Dashboard & Player (Next.js / Mobile)

| Method | Endpoint                      | Description                                                   |
| :----- | :---------------------------- | :------------------------------------------------------------ |
| `GET`  | `/api/dashboard/{id}`         | **Main API**. Returns all aggregated stats for the dashboard. |
| `GET`  | `/api/currently-playing/{id}` | **Live Tracking**. Returns real-time track info & progress.   |
| `GET`  | `/api/profile/{id}`           | **Metadata**. Fetches lightweight user profile info.          |
| `GET`  | `/top-genres`                 | Returns aggregated genre data for visualization.              |

### Genius & Lyrics

| Method | Endpoint                    | Description                                                          |
| :----- | :-------------------------- | :------------------------------------------------------------------- |
| `GET`  | `/api/genius/search-artist` | Find Artist IDs on Genius.                                           |
| `GET`  | `/api/genius/autocomplete`  | Real-time search suggestions.                                        |
| `GET`  | `/api/genius/lyrics/{id}`   | Scrapes lyrics and performs immediate NLP analysis (Emotion + MBTI). |

### Admin & System

| Method | Endpoint              | Description                                    |
| :----- | :-------------------- | :--------------------------------------------- |
| `GET`  | `/admin/system-stats` | System health and data metrics (Text Receipt). |
| `GET`  | `/admin/clear-cache`  | Flushes Redis/Upstash cache.                   |
| `GET`  | `/admin/export-users` | Export user data as CSV.                       |

## Development Setup

### Installation & Run

Choose your preferred environment:

#### Option 1: Virtual Environment (venv)

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Option 2: Conda / Miniconda

```bash
conda create -n personalify python=3.12
conda activate personalify
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Option 3: Docker

```bash
# Run from the project root
docker-compose up -d backend
```

### Documentation

- **Scalar UI**: `http://localhost:8000/docs`
