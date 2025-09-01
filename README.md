# Personalify

## ✨ Live Demo
This application is hosted and can be accessed publicly through the following link:
**[https://personalify.vercel.app/](https://personalify.vercel.app/)**

---

## 1. Introduction

Personalify is a personal Spotify analytics dashboard built to display user music preferences based on data from the Spotify API. This project not only displays data but also analyzes the **mood or vibe** of songs using Natural Language Processing (NLP) from Hugging Face. The project is designed with a distributed system approach, leveraging the integration of various databases (PostgreSQL, MongoDB, Redis) as well as features like FDW and caching.

## 2. Use Case Overview

| Use Case                 | Description                                                                                |
|--------------------------|------------------------------------------------------------------------------------------|
| 🎵 Spotify Login/Auth    | Users log in using Spotify OAuth2 to authorize access to their music data.               |
| 📥 Sync Top Data         | Data such as top artists, top tracks, and genres are synchronized and stored in database. |
| 🧠 Mood Analysis (NLP)   | Analyzes song titles using models from Hugging Face to determine dominant emotions.       |
| ⚡ Caching & History      | Redis is used for fast caching, MongoDB for storing user synchronization history.        |
| 📊 Dashboard             | Responsive frontend displays visualizations based on user device (desktop/mobile).        |
| 🌍 Distributed Query     | FDW enables cross-PostgreSQL queries and external sources (distribution simulation).      |

## 3. System Architecture

The Personalify system consists of several components connected through service-based architecture, with FastAPI backend as the data orchestration center from various sources (Spotify API, Hugging Face API, PostgreSQL, Redis, MongoDB, and FDW).

```text
+-------------------------+      +------------------+      +----------------------+
|       Spotify API       |<---->|      FastAPI     |<---->|   Hugging Face API   |
|       (User Data)       |      |  (Backend API)   |      |  (NLP Emotion Model) |
+-------------------------+      +--------+---------+      +----------------------+
                                          |
              +---------------------------+---------------------------+
              |                           |                           |
              v                           v                           v
      +---------------+             +----------+              +------------------+
      |  PostgreSQL   |<----------->|   Redis  |<------------>|     MongoDB      |
      |   (Main DB)   |             |  (Cache) |              | (Sync History)   |
      +---------------+             +----------+              +------------------+
              |
              v
      +------------------------+
      |   PostgreSQL + FDW     |
      | (foreign remote table) |
      +------------------------+
```

**Component Explanation:**

- **Frontend (Jinja):**  
  Web-based UI that displays user's top artists, tracks, and genres interactively. Responsive display for desktop & mobile.
- **FastAPI (Backend API):**  
  Main server that handles Spotify authentication (OAuth2), data synchronization, database storage, caching, external API calls (Hugging Face) for NLP analysis, and API serving to frontend.
- **PostgreSQL (Main DB):**  
  Stores main metadata such as users, artists, and tracks. Used as the relational center of the system.
- **Redis (Cache):**  
  In-memory cache to store top data (artist, track, genre) per user based on `spotify_id` and `time_range`, with TTL for efficiency.
- **MongoDB (Sync DB):**  
  Stores historical user synchronization logs in document format. Suitable for flexible data and time-based log access.
- **PostgreSQL + FDW:**  
  Foreign Data Wrapper used to access data from other PostgreSQL servers (distribution simulation). Useful for cross-instance queries.


## 4. Technology Stack & Rationale

| Component        | Technology           | Selection Rationale                                                               |
|------------------|----------------------|----------------------------------------------------------------------------------|
| **Frontend**     | Jinja                | Lightweight, fast build time, suitable for creating SPA with reactive display.   |
| **Backend API**  | FastAPI              | Modern Python framework, supports async, fast for building REST APIs.           |
| **Main Database**| PostgreSQL           | Powerful RDBMS, supports complex relations, FDW integration, compatible with analytical tools. |
| **Cache**        | Redis                | In-memory cache with TTL, very fast for storing temporary data per user.        |
| **Sync Storage** | MongoDB              | Suitable for storing history in flexible document format (top data per time).   |
| **Auth**         | Spotify OAuth2       | Official standard protocol from Spotify, secure for login and user data access. |
| **NLP Model**    | Hugging Face API     | Access to pre-trained AI models for emotion analysis without building from scratch. |
| **FDW**          | PostgreSQL FDW       | Used for simulating queries between PostgreSQL instances (distributed query).   |
| **Containerization** | Docker + Compose | Ensures environment isolation, deployment consistency, and easy replication.     |


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

MongoDB is used as a flexible database to store history of user synchronization results from Spotify. Data is stored in the `user_syncs` collection, which contains one document for each combination of `spotify_id` and `time_range` (`short_term`, `medium_term`, `long_term`)

The document structure is flexible and can evolve according to needs, usually containing lists of top artists, tracks, and genres from synchronization results. MongoDB was chosen for its advantages in storing semi-structured data without requiring schema migration.

The synchronization process uses `upsert` operations, so if data for a specific combination already exists, it will be updated. This allows the backend to store history efficiently while maintaining one unique entry per user and time range.

### ⚡ Redis (In-Memory Cache)

Redis is used as a cache layer to accelerate data serving to the frontend dashboard. This cache stores synchronization results in key-value format, with keys constructed based on combinations of `spotify_id` and `time_range`.

Since Redis is a volatile cache (not permanent), data stored in it is temporary and can be given TTL (Time-To-Live) to automatically expire after a certain period. This reduces load on the main database and Spotify API when the same data is frequently accessed in a short time.

Cache will be checked first every time the dashboard is called. If data is not found, the backend will retrieve from Spotify again, store in Redis, and forward to the frontend.

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


## 7. Sample Distributed Query or Scenario

Here are real-world scenario examples that demonstrate distributed system integration in the Personalify project, focusing on utilizing PostgreSQL Foreign Data Wrapper (FDW) and cross-data source queries.

### 🐧 A. Access PostgreSQL Container
First step: enter the postgresfy container to access the main database (streamdb):
sudo docker exec -it postgresfy psql -U admin -d streamdb

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
EXPLAIN VERBOSE SELECT * FROM dummy_data;

### 🍃 B. Query Sync History from MongoDB
MongoDB is used to store Spotify synchronization data based on spotify_id and time_range. Data is stored as flexible JSON documents in the user_syncs collection.

1. Enter MongoDB container:
```bash 
sudo docker exec -it mongofy mongosh 
```
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
1. Enter Redis container:
```bash 
sudo docker exec -it redisfy redis-cli 
```
2. Display cache contents based on key:
```bash
GET top:31xon7qetimdnbmhkupbaszl52nu:short_term
```
3. (Optional) Format JSON using jq:
```bash
sudo docker exec -it redisfy redis-cli GET top:31xon7qetimdnbmhkupbaszl52nu:short_term | jq
```

With these three distribution layers (PostgreSQL-FDW, MongoDB, Redis), the system can combine the strengths of relational queries, document storage, and high-speed caching in one lightweight and scalable application.

## 8. Challenges & Lessons Learned
During Personalify development, several technical challenges emerged alongside efforts to integrate multi-database systems and containerized environments. Here are some main challenges along with lessons learned:

### 🔄 A. FDW (Foreign Data Wrapper)
Challenges:
- When using postgres_fdw, remote database hostname cannot use localhost, because the context is inside a Docker container.
- Common errors occur if not replacing localhost with appropriate container service names (remotedb, postgresfy, etc.).

Solutions:
- Ensure all inter-database connections in Docker context use service names from docker-compose.yml.

Lessons Learned:
- Understand that localhost in containers has different context from localhost on host machine.
- Use IMPORT FOREIGN SCHEMA to simplify foreign table setup rather than creating them one by one.

### 🧩 B. Data Synchronization & Schema
Challenges:
- Spotify data obtained from API is very flexible (non-tabular), while PostgreSQL is structural and requires fixed schema.
- Schema must be consistent between user, artist, and track relations — especially when storing many-to-many data (e.g. user_tracks, user_artists).

Solutions:
- Use MongoDB to store raw synchronization result data per time_range.
- Use Redis for caching formatted query results to avoid repeated parsing.

Lessons Learned:
- Storing data in appropriate places (structured vs unstructured) is important for efficiency and scalability.

### 🚨 C. Caching Strategy
Challenges:

- Redis data is ephemeral. If Redis container dies without volume persistence, all cache is lost.
- Without good key management (e.g.: top:{spotify_id}:{time_range}), cache can overwrite or conflict with each other.

Solutions:
- Apply systematic and unique key naming.
- Store sync result cache per user + time_range to avoid redundancy.

Lessons Learned:
- Redis is ideal for read-heavy scenarios like dashboards, but not for permanent data.

### 🔧 D. Deployment & Containerization
Challenges:
- Debugging multi-container can be complicated without good log monitoring.
- Some container services need specific startup order (e.g. Postgres must be ready before backend queries).

Solutions:
- Use depends_on in docker-compose.yml.
- Utilize volumes for persistence and named networks so services recognize each other.

Lessons Learned:
- Containerization is very powerful for isolation, but requires understanding of dependencies and lifecycle order.

## 9. Conclusion
Personalify is a project designed to explore distributed system concepts in the context of real data-based applications. By utilizing data from Spotify through OAuth2 authentication processes, users can see their music preferences such as top artists, songs, and genres grouped by specific time ranges. This data is then stored and processed through a combination of databases, each with different roles, reflecting a multi-layer and truly distributed architectural approach.

PostgreSQL is used as the main database to store relational entities such as users, artists, and songs, including many-to-many relationships between these entities. Meanwhile, MongoDB serves as storage for synchronization history per user and time_range in more flexible JSON document format, reflecting separation of concerns between data structure and flexibility. Redis is also used to store reformatted synchronization results in cache form, so the system can avoid repeated requests to Spotify API or queries to the main database for the same data.

Furthermore, this project implements PostgreSQL Foreign Data Wrapper (FDW) to access tables from external databases (remote DB) in real-time. This shows how cross-database queries can be performed as if they came from one source, enabling data federation flexibility and cross-node scenarios. In practice, FDW is used to read external tables and combine them with local data through join operations that run transparently.

During development, several technical challenges were successfully overcome, from synchronizing non-homogeneous data between Spotify API and relational table structures, to configuring hostnames between Docker containers so they can connect to each other. These challenges resulted in practical learning about technology selection, cache management, and efficient data integration from different sources.

Overall, Personalify has successfully become a proof of concept for distributed systems that combine modern authentication, external API synchronization, multi-database storage, as well as cache and data federation in one cohesive ecosystem. This project not only meets the functional and technical aspects of the Distributed Data Processing assignment, but also provides real-world practical experience in building and managing complex and scalable data systems.
