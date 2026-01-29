# Personalify Backend API

The backend for Personalify is built with **FastAPI** (Python). It serves as the orchestrator for:

- **Spotify OAuth2 Authentication**
- **Data Synchronization** (Artists, Tracks, Genres)
- **Database Management** (PostgreSQL, MongoDB, Redis)
- **External Integrations** (Genius API, Hugging Face NLP)

## Code Structure

Key modules handling business logic:

- **`spotify_handler.py`**: **(New)** Centralized handler for all Spotify API interactions. Manages token refreshment, fetching top data, and parsing raw responses before saving to DB/Cache.
- **`genius_lyrics.py`**: Handles scraping and parsing lyrics from Genius.com, including caching mechanisms.
- **`nlp_handler.py`**: Integrates with Hugging Face API to perform sentiment and emotion analysis on lyrics and track titles.
- **`db_handler.py`**: Manages PostgreSQL connections and CRUD operations for Users, Artists, and Tracks.
- **`mongo_handler.py`**: Handles logging of synchronization history into MongoDB.
- **`cache_handler.py`**: interface for Redis/Upstash caching operations.

## API Endpoints

### Authentication (`Auth`)

| Method | Endpoint    | Description                                                                         |
| :----- | :---------- | :---------------------------------------------------------------------------------- |
| `GET`  | `/login`    | Initiates Spotify OAuth2 flow. Redirects to Spotify login.                          |
| `GET`  | `/callback` | Handles Spotify callback, exchanges code for token, and syncs basic user profiling. |
| `GET`  | `/logout`   | Clears user session and cookies.                                                    |

### Data Synchronization (`Sync`)

| Method | Endpoint                       | Description                                                                                                                |
| :----- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/sync/top-data`               | **Core Sync**. Fetches Top Artists & Tracks from Spotify, saves to DB/Mongo, caches in Redis, and returns structured JSON. |
| `POST` | `/analyze-emotions-background` | Triggers background processing for NLP emotion analysis of top tracks.                                                     |

### Queries & Dashboard (`Query` / `Dashboard`)

| Method | Endpoint                      | Description                                                                                                           |
| :----- | :---------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/top-data`                   | Retrieves cached top artists/tracks for a specific user and time range.                                               |
| `GET`  | `/top-genres`                 | aggregated top genres based on user's top artists.                                                                    |
| `GET`  | `/history`                    | Returns synchronization history logs from MongoDB.                                                                    |
| `GET`  | `/api/dashboard/{spotify_id}` | **Main Dashboard API**. Returns aggregated data (User, Artists, Tracks, Genres, Emotions) for the frontend dashboard. |

### NLP & Genius (`NLP` / `Genius`)

| Method | Endpoint                        | Description                                         |
| :----- | :------------------------------ | :-------------------------------------------------- |
| `POST` | `/analyze-lyrics`               | Analyzes emotion of raw text input (lyrics).        |
| `GET`  | `/api/genius/search-artist`     | Searches for artist ID on Genius.                   |
| `GET`  | `/api/genius/autocomplete`      | Autocomplete suggestions for artist/song search.    |
| `GET`  | `/api/genius/artist-songs/{id}` | Fetches songs by a specific artist ID.              |
| `GET`  | `/api/genius/lyrics/{song_id}`  | Fetches and analyzes lyrics for a specific song ID. |

### Background Tasks (QStash)

| Method | Endpoint                      | Description                                                               |
| :----- | :---------------------------- | :------------------------------------------------------------------------ |
| `POST` | `/start-background-analysis`  | Queues comprehensive analysis task (can offload to QStash in production). |
| `POST` | `/api/tasks/process-analysis` | Webhook handler for QStash to execute analysis logic securely.            |
| `POST` | `/fire-qstash-event`          | Manually fires an event log to QStash.                                    |
| `POST` | `/api/tasks/log-activity`     | Webhook handler for logging QStash activities.                            |

### Admin Utils (`Admin`)

| Method | Endpoint                  | Description                                                                        |
| :----- | :------------------------ | :--------------------------------------------------------------------------------- |
| `GET`  | `/admin/system-stats`     | Returns a text-based "receipt" of system stats (User count, DB stats, Redis keys). |
| `GET`  | `/admin/clear-cache`      | Flushes Redis cache for top data.                                                  |
| `GET`  | `/admin/user-report/{id}` | detailed text report for a specific user.                                          |
| `GET`  | `/admin/export-users`     | Downloads user list as CSV.                                                        |

## Setup & Run

### Prerequisites

- Python 3.12+
- Dependencies installed via `pip install -r requirements.txt`
- `.env` file configured in root directory.

### Running Local Server

```bash
# Navigate to root and run:
uvicorn app.main:app --reload --port 8000
```

API Documentation (Scalar UI) available at: `http://localhost:8000/docs`
