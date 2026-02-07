# Personalify Backend API

The backend for Personalify is a high-performance **FastAPI** (Python) application that orchestrates the core data pipeline, authentication, and AI-driven analysis.

## Core Responsibilities

- **Spotify OAuth2**: Securely manages login flows and token rotation for both Web and Mobile.
- **Data Pipeline**: Synchronizes top artists, tracks, and genres into a multi-layer storage system (PostgreSQL + MongoDB).
- **AI Intelligence**: Performs deep emotion analysis on lyrics and track titles using a hybrid NLP approach.
- **Real-Time Tracking**: Provides low-latency endpoints for "Currently Playing" status and progress.

## System Architecture & Handlers

The backend follows a modular architecture where each handler manages a specific domain:

- **`spotify_handler.py`**: The heart of Spotify integration. Handles recursive syncing, token refreshment, and raw data parsing.
- **`nlp_handler.py`**: A sophisticated analysis engine. Includes **Google Translation** integration and a **Custom Slang Dictionary** (Indonesian/Sundanese) to ensure high-accuracy sentiment detection across languages.
- **`genius_lyrics.py`**: Scrapes and parses lyrics from the Genius API with built-in caching.
- **`db_handler.py`**: Manages the relational schema in **PostgreSQL** (Users, Tracks, Artists).
- **`mongo_handler.py`**: Logs detailed synchronization history for auditing and analysis.
- **`cache_handler.py`**: High-speed caching layer using **Redis/Upstash** to minimize API latency.

## API Endpoints

### Authentication & Access

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/login` | Starts Spotify OAuth2 flow. Optional `mobile=true` for app-linking. |
| `GET` | `/callback` | Exchange code for token and initializes user profiling. |
| `GET` | `/api/me` | Get current user's Spotify ID from cookies. |
| `POST` | `/auth/refresh` | Refresh access tokens (Supports JSON body for Mobile). |
| `POST` | `/request-access` | Captures access requests for the private beta. |
| `GET` | `/logout` | Invalidates session and clears cookies. |

### Synchronization & Analysis

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/sync/top-data` | Synchronizes Top Spotify data into the persistent database. |
| `POST` | `/analyze-emotions-background` | Queues background emotion analysis for all top tracks. |
| `POST` | `/analyze-lyrics` | Immediate NLP analysis for raw text/lyrics input. |

### Dashboard & Player (Next.js / Mobile)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/{id}` | **Main API**. Returns all aggregated stats for the dashboard. |
| `GET` | `/api/currently-playing/{id}` | **Live Tracking**. Returns real-time track info & progress. |
| `GET` | `/api/profile/{id}` | **Metadata**. Fetches lightweight user profile info. |
| `GET` | `/top-genres` | Returns aggregated genre data for visualization. |

### Genius & Lyrics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/genius/search-artist` | Find Artist IDs on Genius. |
| `GET` | `/api/genius/autocomplete` | Real-time search suggestions. |
| `GET` | `/api/genius/lyrics/{id}` | Scrapes lyrics and performs immediate NLP analysis. |

### Admin & System

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/admin/system-stats` | System health and data metrics (Text Receipt). |
| `GET` | `/admin/clear-cache` | Flushes Redis/Upstash cache. |
| `GET` | `/admin/export-users` | Export user data as CSV. |

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
