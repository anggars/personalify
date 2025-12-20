# Personalify

## ✨ Live Demo
This application is hosted and can be accessed publicly through the following link:
**[https://personalify.vercel.app/](https://personalify.vercel.app/)**

---

## 1. Introduction

Personalify is a personal Spotify analytics dashboard built to display user music preferences based on data from the Spotify API. This project not only displays data but also analyzes the **mood or vibe** of songs using Natural Language Processing (NLP) from Hugging Face. Additionally, users can **search for lyrics from any artist or song** via the Genius API and analyze the emotional tone of those lyrics. The project is designed with a distributed system approach, leveraging the integration of various databases (PostgreSQL, MongoDB, Redis) as well as features like FDW and caching.

## 2. Use Case Overview

| Use Case                 | Description                                                                                |
|--------------------------|------------------------------------------------------------------------------------------|
| 🎵 Spotify Login/Auth    | Users log in using Spotify OAuth2 to authorize access to their music data.               |
| 📥 Sync Top Data         | Data such as top artists, top tracks, and genres are synchronized and stored in database. |
| 🧠 Mood Analysis (NLP)   | Analyzes song titles using models from Hugging Face to determine dominant emotions.       |
| 🎤 Genius Lyrics Search  | Search for any song lyrics from Genius and analyze the emotional content.                 |
| ⚡ Caching & History      | Redis is used for fast caching, MongoDB for storing user synchronization history.        |
| 📊 Dashboard             | Responsive frontend displays visualizations based on user device (desktop/mobile).        |
| 🌍 Distributed Query     | FDW enables cross-PostgreSQL queries and external sources (distribution simulation).      |

## 3. System Architecture

The Personalify system consists of several components connected through service-based architecture, with FastAPI backend as the data orchestration center from various sources (Spotify API, Genius API, Hugging Face API, PostgreSQL, Redis, MongoDB, and FDW).

```text
                                 +------------------+
                                 |      Vercel      |
                                 |   (Serverless)   |
                                 +--------+---------+               +----------------------+
                                          |                  +----->|  Hugging Face API    |
                                          |                  |      | (NLP Emotion Model)  |
+-------------------------+      +------------------+        |      +----------------------+
|       Spotify API       |<---->|     FastAPI      |<-------+
|       (User Data)       |      |  (Backend API)   |        |      +----------------------+
+-------------------------+      +--------+---------+        +----->|      Genius API      |
                                          |                         |     (Lyrics Data)    |
                                          |                         +----------------------+
                                          |
              +---------------------------+---------------------------+
              |                           |                           |
              v                           v                           v
      +---------------+           +---------------+         +------------------+
      |     Neon      |           |    Upstash    |         |  MongoDB Atlas   |
      | (PostgreSQL)  |           |    (Redis)    |         |  (Sync History)  |
      +-------+-------+           +---------------+         +------------------+
              |
              v
 +------------------------+
 |   PostgreSQL + FDW     |
 | (foreign remote table) |
 +------------------------+
```

**Component Explanation:**

- **Vercel (Serverless):**
The cloud platform hosting the application. It runs the FastAPI backend in a serverless environment and serves the frontend assets globally.

- **Spotify API:**
The primary external data source. It handles user authentication (OAuth2) and provides the core music data (top artists, tracks, genres) for the application.

- **Frontend (Jinja):**  
  Web-based UI that displays user's top artists, tracks, and genres interactively. Includes a dedicated **Lyrics Analyzer** page powered by Genius API. Responsive display for desktop & mobile.
  
- **FastAPI (Backend API):**  
  Main server that handles Spotify authentication (OAuth2), data synchronization, database storage, caching, external API calls (Hugging Face for NLP analysis, Genius for lyrics), and API serving to frontend.
  
- **PostgreSQL (Main DB):**  
  Stores main metadata such as users, artists, and tracks. Can run **locally via Docker** or use **Neon (cloud-hosted PostgreSQL)** for production/development.
  
- **Redis (Cache):**  
  In-memory cache to store top data (artist, track, genre) per user based on `spotify_id` and `time_range`, with TTL for efficiency. Can run **locally via Docker** or use **Upstash (cloud-hosted Redis)** for production.
  
- **MongoDB (Sync DB):**  
  Stores historical user synchronization logs in document format. Can run **locally via Docker** or use **MongoDB Atlas (cloud-hosted MongoDB)** for production.
  
- **PostgreSQL + FDW:**  
  Foreign Data Wrapper used to access data from other PostgreSQL servers (distribution simulation). Useful for cross-instance queries.
  
- **Genius API:**  
  Provides song lyrics data from the Genius platform. The backend implements a custom scraping strategy (using translation proxies) to fetch lyrics content and bypass direct access limitations.
  
- **Hugging Face API:**  
  Provides pre-trained NLP models (GoEmotions) for sentiment and emotion analysis of song titles and lyrics.

---

## 4. Technology Stack & Rationale

| Component        | Technology           | Selection Rationale                                                               |
|------------------|----------------------|----------------------------------------------------------------------------------|
| **Frontend**     | Jinja                | Lightweight, fast build time, suitable for creating SPA with reactive display.   |
| **Backend API**  | FastAPI              | Modern Python framework, supports async, fast for building REST APIs.           |
| **Main Database**| PostgreSQL (Neon/Local) | Serverless Postgres designed for cloud, separates storage & compute. Neon for cloud, Docker for local. |
| **Cache**        | Redis (Upstash/Local) | In-memory cache with TTL, very fast for storing temporary data per user. Upstash for cloud, Docker for local. |
| **Sync Storage** | MongoDB (Atlas/Local) | Suitable for storing history in flexible document format. Atlas for cloud, Docker for local. |
| **Auth**         | Spotify OAuth2       | Official standard protocol from Spotify, secure for login and user data access. |
| **Lyrics**       | Genius API           | Genius provides lyrics data; custom scraping logic with retry mechanisms handles content retrieval. |
| **NLP Model**    | Hugging Face API     | Access to pre-trained AI models for emotion analysis without building from scratch. |
| **FDW**          | PostgreSQL FDW       | Used for simulating queries between PostgreSQL instances (distributed query).   |
| **Containerization** | Docker + Compose (Optional) | Ensures environment isolation, deployment consistency, and easy replication for local development. |
| **Cloud Deployment** | Vercel           | Serverless deployment platform with seamless FastAPI integration and global CDN. |

---

## 5. Database Schema Design

### 🗄️ PostgreSQL (Main DB)

Used to store main metadata such as users, artists, and tracks. Many-to-many relations are stored in `user_tracks` and `user_artists` tables.

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  spotify_id TEXT UNIQUE,
  display_name TEXT
);

-- Artists
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT,
  popularity INTEGER,
  image_url TEXT
);

-- Tracks
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT,
  popularity INTEGER,
  preview_url TEXT
);

-- User-tracks relation
CREATE TABLE IF NOT EXISTS user_tracks (
  spotify_id TEXT,
  track_id TEXT,
  PRIMARY KEY (spotify_id, track_id),
  FOREIGN KEY (spotify_id) REFERENCES users(spotify_id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- User-artists relation
CREATE TABLE IF NOT EXISTS user_artists (
  spotify_id TEXT,
  artist_id TEXT,
  PRIMARY KEY (spotify_id, artist_id),
  FOREIGN KEY (spotify_id) REFERENCES users(spotify_id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
```

### 📄 MongoDB (Sync History DB)

MongoDB is used as a flexible database to store history of user synchronization results from Spotify. Data is stored in the `user_syncs` collection, which contains one document for each combination of `spotify_id` and `time_range` (`short_term`, `medium_term`, `long_term`).

The document structure is flexible and can evolve according to needs, usually containing lists of top artists, tracks, and genres from synchronization results. MongoDB was chosen for its advantages in storing semi-structured data without requiring schema migration.

The synchronization process uses `upsert` operations, so if data for a specific combination already exists, it will be updated. This allows the backend to store history efficiently while maintaining one unique entry per user and time range.

### ⚡ Redis (In-Memory Cache)

Redis is used as a cache layer to accelerate data serving to the frontend dashboard. This cache stores synchronization results in key-value format, with keys constructed based on combinations of `spotify_id` and `time_range`.

Since Redis is a volatile cache (not permanent), data stored in it is temporary and can be given TTL (Time-To-Live) to automatically expire after a certain period. This reduces load on the main database and Spotify API when the same data is frequently accessed in a short time.

Cache will be checked first every time the dashboard is called. If data is not found, the backend will retrieve from Spotify again, store in Redis, and forward to the frontend.

---

## 6. Sharding and Replication Strategy

The `Personalify` system leverages distributed data processing principles through a combination of three different types of databases with different characteristics, with the following strategy:

### 🧩 Redis (Cache-Based Sharding)

Redis is used as an in-memory cache that indirectly forms a sharding pattern based on keys `spotify_id` and `time_range`. Since Redis stores data in key-value format, data distribution happens automatically based on key space. With this approach, each user has their own cache partition, so they don't interfere with each other and can be accessed quickly.

Redis also allows horizontal scale-out with clustering techniques if capacity grows significantly.

### 🗂️ MongoDB (Document-Based Distribution)

MongoDB stores Spotify user synchronization history in document format, and is very suitable for semi-structured data storage models that continue to evolve. Although the current deployment uses a single instance, MongoDB supports automatic replication (replica set) and native sharding based on keys like `spotify_id`.

MongoDB replication strategy:
- Provides failure tolerance (failover).
- Enables reading from secondary nodes (read scalability).

MongoDB sharding strategy (optional):
- Can be activated using hashed sharding key (e.g., `spotify_id`).
- Suitable for even distribution of user data.

### 🏛️ PostgreSQL FDW (Distributed Query via Foreign Data Wrapper)

One of the main points in this architecture is the use of **PostgreSQL Foreign Data Wrapper (FDW)**, which allows the backend to perform queries to external databases as if they were part of one unified system.

In this system:
- Main PostgreSQL stores metadata.
- Other PostgreSQL instances (dummy/fdw) can be connected using `postgres_fdw`.
- Cross-node queries can be executed as usual with `SELECT` or `JOIN`, without needing manual ETL.

Example scenario:
- Store Spotify user data on node A, and aggregate statistics on node B.
- Node A can query node B without data migration, simply with `IMPORT FOREIGN SCHEMA`.

### 🔄 Multi-Database Integration (Manual Sharding)

Overall, this system leverages "manual sharding" based on function:

| Layer      | Database     | Function                                             |
|------------|--------------|-----------------------------------------------------|
| Metadata   | PostgreSQL   | Store artist, track, user data and their relations |
| History    | MongoDB      | Store synchronization history (document-based)     |
| Cache      | Redis        | Fast serving based on `spotify_id` key             |
| Cross-node | PostgreSQL + FDW | Simulate distributed queries between DB instances |

This strategy was chosen to demonstrate how systems can use various storage and distribution models for different needs, and support scalability if the project grows larger.

---

## 7. Local Development Setup

Personalify can be run locally in **two ways**: using **Docker Compose** (containerized) or **standalone Python environment** (Miniconda/Anaconda/venv). Both methods support connecting to **cloud databases** (Neon, MongoDB Atlas, Upstash) or **local databases** (via Docker).

### 🐳 Option 1: Running with Docker (Containerized)

This method uses Docker Compose to run the entire stack, including local PostgreSQL, MongoDB, and Redis containers (optional if you prefer local databases).

#### Prerequisites:
- Docker and Docker Compose installed
- `.env` file configured (see `.env.example`)

#### Steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anggars/personalify.git
   cd personalify
   ```

2. **Create and configure `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your credentials:
   ```env
   # Spotify
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/callback

   # PostgreSQL (Local Docker OR Neon)
   # For Docker:
   POSTGRES_HOST=postgresfy
   POSTGRES_PORT=5432
   POSTGRES_DB=streamdb
   POSTGRES_USER=admin
   POSTGRES_PASSWORD=admin123
   
   # For Neon (comment out above and use this):
   # DATABASE_URL=postgresql://neondb_owner:password@cluster.neon.tech/neondb

   # MongoDB (Local Docker OR Atlas)
   # For Docker:
   MONGO_HOST=mongofy
   MONGO_PORT=27017
   
   # For Atlas (comment out above and use this):
   # MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/database

   # Redis (Local Docker OR Upstash)
   # For Docker:
   REDIS_HOST=redisfy
   REDIS_PORT=6379
   
   # For Upstash (comment out above and use this):
   # REDIS_URL=redis://default:password@host:port

   # Hugging Face
   HUGGING_FACE_API_KEY=your_hugging_face_token

   # Genius API
   GENIUS_ACCESS_TOKEN=your_genius_token
   ```

3. **Create Docker network:**
   ```bash
   docker network create personalify
   ```

4. **Start the services:**
   ```bash
   docker compose up -d --build
   ```

5. **Access the application:**
   Open your browser and navigate to:
   ```
   http://127.0.0.1:8000
   ```

6. **Stop the services:**
   ```bash
   docker compose down
   ```

---

### 🐍 Option 2: Running Standalone (Python Environment)

This method runs FastAPI directly on your local machine using a Python virtual environment (Miniconda, Anaconda, or standard venv). This approach is **lighter** and does **not require Docker**.

#### Prerequisites:
- Python 3.12+ installed (via Miniconda, Anaconda, or standard Python)
- Cloud database accounts (Neon, MongoDB Atlas, Upstash) **OR** local Docker containers for databases
- `.env` file configured (see `.env.example`)

#### Steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anggars/personalify.git
   cd personalify
   ```

2. **Create Conda environment (if using Miniconda/Anaconda):**
   ```bash
   conda create -n personalify python=3.12
   conda activate personalify
   ```
   
   **Or create venv (if using standard Python):**
   ```bash
   python -m venv .venv
   
   # Windows
   .venv\Scripts\activate
   
   # Linux/Mac
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Create and configure `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure for **cloud databases**:
   ```env
   # Spotify
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/callback

   # PostgreSQL (Neon)
   DATABASE_URL=postgresql://neondb_owner:password@cluster.neon.tech/neondb

   # MongoDB (Atlas)
   MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/database

   # Redis (Upstash)
   REDIS_URL=redis://default:password@host:port

   # Hugging Face
   HUGGING_FACE_API_KEY=your_hugging_face_token

   # Genius API
   GENIUS_ACCESS_TOKEN=your_genius_token
   ```

5. **Run the development server:**
   
   **For Windows (using provided batch script):**
   ```bash
   dev.bat
   ```
   
   **For Linux/Mac (manual command):**
   ```bash
   export PYTHONPATH=backend
   uvicorn app.main:app --reload --port 8000
   ```
   
   The `dev.bat` script contains:
   ```bat
   @echo off
   echo Starting Local Personalify (Cloud DB Mode)...

   :: 1. Set Path so Python knows the backend location
   set PYTHONPATH=backend

   :: 2. Activate Conda (Just in case you forgot to activate in the terminal)
   call conda activate personalify

   :: 3. Run Server
   :: --reload is active so if the code is changed, the server restarts itself
   uvicorn app.main:app --reload --port 8000
   ```

6. **Access the application:**
   Open your browser and navigate to:
   ```
   http://127.0.0.1:8000
   ```

7. **Stop the server:**
   Press `Ctrl+C` in the terminal.

---

## 8. Sample Distributed Query or Scenario

Here are real-world scenario examples that demonstrate distributed system integration in the Personalify project, focusing on utilizing PostgreSQL Foreign Data Wrapper (FDW) and cross-data source queries.

### 🐧 A. Access PostgreSQL Container (Docker Setup)
First step: enter the postgresfy container to access the main database (streamdb):
```bash
sudo docker exec -it postgresfy psql -U admin -d streamdb
```

To display table list with details:
```bash 
\dt+
```
To see local table structures like users, artists, and tracks:
```bash 
\d+ users
\d+ artists
\d+ tracks
```
Use the following queries to see main table contents:
```sql
SELECT * FROM users;
SELECT * FROM artists;
SELECT * FROM tracks;
SELECT * FROM user_tracks;
SELECT * FROM user_artists;
```

If you have set up postgres_fdw and imported foreign tables like dummy_data, you can run:
1. See foreign table structure:
```bash 
\d+ dummy_data 
```
2. Display foreign table contents:
```sql 
SELECT * FROM dummy_data; 
```
3. Join local table (users) with foreign table (dummy_data):
```sql 
SELECT u.display_name, d.name AS remote_note
FROM users u
JOIN dummy_data d ON u.id = d.id;
```

4. See execution plan and remote SQL:
```sql
EXPLAIN VERBOSE SELECT * FROM dummy_data;
```

### 🍃 B. Query Sync History from MongoDB
MongoDB is used to store Spotify synchronization data based on spotify_id and time_range. Data is stored as flexible JSON documents in the user_syncs collection.

**For Docker setup:**
1. Enter MongoDB container:
```bash 
sudo docker exec -it mongofy mongosh 
```

**For cloud setup (Atlas):**
1. Connect using MongoDB Compass or `mongosh` CLI with your connection string.

2. Use database and check collections:
```bash 
use personalify_db 
db.user_syncs.find().pretty() 
```
3. Example query user history based on spotify_id:
```bash 
db.user_syncs.find({ spotify_id: "31xon7qetimdnbmhkupbaszl52nu" }).pretty() 
```

### 🔴 C. Access Redis Cache for Top Data
Redis is used to store top artists/tracks/genres data from synchronization results for fast access without always calling Spotify API.

**For Docker setup:**
1. Enter Redis container:
```bash 
sudo docker exec -it redisfy redis-cli 
```

**For cloud setup (Upstash):**
1. Use the Upstash dashboard or connect via CLI with your connection string.

2. Display cache contents based on key:
```bash
GET top:31xon7qetimdnbmhkupbaszl52nu:short_term
```
3. (Optional) Format JSON using jq:
```bash
sudo docker exec -it redisfy redis-cli GET top:31xon7qetimdnbmhkupbaszl52nu:short_term | jq
```

With these three distribution layers (PostgreSQL-FDW, MongoDB, Redis), the system can combine the strengths of relational queries, document storage, and high-speed caching in one lightweight and scalable application.

---

## 9. Challenges & Lessons Learned

During Personalify development, several technical challenges emerged alongside efforts to integrate multi-database systems and containerized environments. Here are some main challenges along with lessons learned:

### 🔄 A. FDW (Foreign Data Wrapper)
**Challenges:**
- When using postgres_fdw, remote database hostname cannot use localhost, because the context is inside a Docker container.
- Common errors occur if not replacing localhost with appropriate container service names (remotedb, postgresfy, etc.).

**Solutions:**
- Ensure all inter-database connections in Docker context use service names from docker-compose.yml.

**Lessons Learned:**
- Understand that localhost in containers has different context from localhost on host machine.
- Use IMPORT FOREIGN SCHEMA to simplify foreign table setup rather than creating them one by one.

### 🧩 B. Data Synchronization & Schema
**Challenges:**
- Spotify data obtained from API is very flexible (non-tabular), while PostgreSQL is structural and requires fixed schema.
- Schema must be consistent between user, artist, and track relations — especially when storing many-to-many data (e.g. user_tracks, user_artists).

**Solutions:**
- Use MongoDB to store raw synchronization result data per time_range.
- Use Redis for caching formatted query results to avoid repeated parsing.

**Lessons Learned:**
- Storing data in appropriate places (structured vs unstructured) is important for efficiency and scalability.

### 🚨 C. Caching Strategy
**Challenges:**
- Redis data is ephemeral. If Redis container dies without volume persistence, all cache is lost.
- Without good key management (e.g.: top:{spotify_id}:{time_range}), cache can overwrite or conflict with each other.

**Solutions:**
- Apply systematic and unique key naming.
- Store sync result cache per user + time_range to avoid redundancy.
- Migrate to Upstash (cloud Redis) for persistent and managed caching in production.

**Lessons Learned:**
- Redis is ideal for read-heavy scenarios like dashboards, but not for permanent data.
- Cloud-hosted Redis (Upstash) eliminates concerns about container failures and provides better reliability.

### 🔧 D. Deployment & Containerization
**Challenges:**
- Debugging multi-container can be complicated without good log monitoring.
- Some container services need specific startup order (e.g. Postgres must be ready before backend queries).
- Initial deployment on Render.com required Docker support but was limited by cold start times.

**Solutions:**
- Use depends_on in docker-compose.yml.
- Utilize volumes for persistence and named networks so services recognize each other.
- Migrate to Vercel for serverless deployment, eliminating container management overhead.
- Use cloud-hosted databases (Neon, Atlas, Upstash) instead of local containers for production.

**Lessons Learned:**
- Containerization is very powerful for isolation, but requires understanding of dependencies and lifecycle order.
- Serverless platforms like Vercel offer faster cold starts and simpler deployment workflows.
- Separating database concerns (using managed cloud services) from application deployment simplifies architecture.

### 🎤 E. Genius API & Lyrics Fetching
**Challenges:**
- Genius API provides song metadata but does not directly return lyrics in JSON format.
- Lyrics must be scraped from Genius.com HTML pages.
- When deployed on Vercel (serverless environment), direct scraping fails due to CORS restrictions and rate limiting.

**Solutions:**
- IImplement a custom proxy strategy to fetch HTML content from [Genius.com](https://genius.com).
- Parse the HTML server-side to extract clean lyrics text.
- Cache lyrics results to minimize repeated scraping requests.

**Lessons Learned:**
- Serverless environments have limitations on external HTTP requests that require workarounds.
- Using flexible proxy strategies and retry logic is effective for bypassing scraping restrictions.
- Always respect API rate limits and implement proper error handling for third-party services.

### ☁️ F. Cloud Database Migration
**Challenges:**
- Transitioning from local Docker databases to cloud-hosted services required connection string changes.
- Managing environment variables across local development and production deployments.

**Solutions:**
- Use `.env` file with conditional logic to support both local and cloud database connections.
- Leverage Neon for PostgreSQL, MongoDB Atlas for document storage, and Upstash for Redis caching.

**Lessons Learned:**
- Cloud databases offer better reliability, automatic backups, and scalability without manual infrastructure management.
- Using managed database services allows developers to focus on application logic rather than database administration.

---

## 10. Conclusion

Personalify is a project designed to explore distributed system concepts in the context of real data-based applications. By utilizing data from Spotify through OAuth2 authentication processes, users can see their music preferences such as top artists, songs, and genres grouped by specific time ranges. **Additionally, users can search for and analyze lyrics from any song via the Genius API**, providing deeper insights into the emotional content of their favorite music.

This data is then stored and processed through a combination of databases, each with different roles, reflecting a multi-layer and truly distributed architectural approach. PostgreSQL is used as the main database to store relational entities such as users, artists, and songs, including many-to-many relationships between these entities. Meanwhile, MongoDB serves as storage for synchronization history per user and time_range in more flexible JSON document format, reflecting separation of concerns between data structure and flexibility. Redis is also used to store reformatted synchronization results in cache form, so the system can avoid repeated requests to Spotify API or queries to the main database for the same data.

Furthermore, this project implements PostgreSQL Foreign Data Wrapper (FDW) to access tables from external databases (remote DB) in real-time. This shows how cross-database queries can be performed as if they came from one source, enabling data federation flexibility and cross-node scenarios. In practice, FDW is used to read external tables and combine them with local data through join operations that run transparently.

The project has evolved significantly from its initial Docker-only deployment to support **both containerized and standalone Python environments**. For local development, users can choose between running the entire stack via Docker Compose (including local databases) or running FastAPI standalone using Miniconda/Anaconda/venv with cloud-hosted databases (Neon, MongoDB Atlas, Upstash). This flexibility allows developers to work in their preferred environment without compromising functionality.

In production, Personalify is deployed as a **serverless application on Vercel**, leveraging managed cloud databases for reliability and scalability. The implementation of a robust scraping mechanism enables seamless lyrics fetching from **Genius API**, overcoming restrictions inherent in serverless environments. The **Hugging Face API** powers NLP-based emotion analysis, providing users with actionable insights into the mood and vibe of their music.

During development, several technical challenges were successfully overcome, from synchronizing non-homogeneous data between Spotify API and relational table structures, to configuring hostnames between Docker containers so they can connect to each other, to implementing proxy solutions for third-party API restrictions. These challenges resulted in practical learning about technology selection, cache management, serverless deployment strategies, and efficient data integration from different sources.

Overall, Personalify has successfully become a proof of concept for distributed systems that combine modern authentication, external API synchronization, multi-database storage, as well as cache and data federation in one cohesive ecosystem. This project not only meets the functional and technical aspects of the Distributed Data Processing assignment, but also provides real-world practical experience in building and managing complex and scalable data systems that can run both locally and in production environments.

---

## 11. Credits & Acknowledgments

- **[Spotify API](https://developer.spotify.com/)** for providing comprehensive music data and authentication services.
- **[Genius API](https://genius.com/developers/)** for enabling access to song lyrics and artist information.
- **[Hugging Face](https://huggingface.co/)** for pre-trained NLP models that power emotion analysis.
- **[Vercel](https://vercel.com/)** for seamless serverless deployment and hosting.
- **[Neon](https://neon.tech/)**, **[MongoDB Atlas](https://www.mongodb.com/atlas/)**, and **[Upstash](https://upstash.com/)** for managed cloud database services.
- **[Docker](http://docker.com/)** for containerization and local development environment isolation.
- **[FastAPI](https://fastapi.tiangolo.com/)** for a modern, high-performance Python web framework.

**Created by [アリツ](https://desty.page/anggars)** © 2025

---



