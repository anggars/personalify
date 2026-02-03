import os
import psycopg2
from psycopg2.extras import execute_values
from urllib.parse import urlparse
import threading

from dotenv import load_dotenv
load_dotenv()

# ========== SUPABASE SECONDARY DATABASE ==========

def get_supabase_conn():
    """Connect to Supabase (secondary database)"""
    # Prioritize SUPABASE_URL, fallback to legacy SUPABASE_DATABASE_URL
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
    if not supabase_url:
        print("[SUPABASE] Warning: SUPABASE_URL not set.")
        return None
    
    try:
        result = urlparse(supabase_url)
        db_params = {
            'dbname': result.path[1:],
            'user': result.username,
            'password': result.password,
            'host': result.hostname,
            'port': result.port
        }
        return psycopg2.connect(**db_params)
    except Exception as e:
        print(f"[SUPABASE] Connection failed: {e}")
        return None

def async_write_to_supabase(query, params):
    """Fire-and-forget write to Supabase in background thread"""
    def write():
        try:
            conn = get_supabase_conn()
            if not conn:
                return  # Supabase not configured, skip silently
            
            with conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                conn.commit()
            conn.close()
            print("[SUPABASE] ✓ Sync success")
        except Exception as e:
            print(f"[SUPABASE] ✗ Sync failed: {e}")
    
    # Run in background thread (daemon=True so it doesn't block shutdown)
    threading.Thread(target=write, daemon=True).start()

def async_batch_write_to_supabase(query, batch_data):
    """Fire-and-forget batch write to Supabase"""
    def write():
        try:
            conn = get_supabase_conn()
            if not conn:
                return
            
            with conn:
                with conn.cursor() as cur:
                    execute_values(cur, query, batch_data)
                conn.commit()
            conn.close()
            print(f"[SUPABASE] ✓ Batch sync success ({len(batch_data)} rows)")
        except Exception as e:
            print(f"[SUPABASE] ✗ Batch sync failed: {e}")
    
    threading.Thread(target=write, daemon=True).start()

# ========== PRIMARY DATABASE (NEON) ==========

from contextlib import contextmanager
from psycopg2 import pool

# Global Connection Pool
pg_pool = None

def init_pg_pool():
    global pg_pool
    if pg_pool: return

    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL:
        result = urlparse(DATABASE_URL)
        print(f"DB POOL CONNECTING TO (CLOUD): {result.hostname}:{result.port}")
        db_params = {
            'dbname': result.path[1:],
            'user': result.username,
            'password': result.password,
            'host': result.hostname,
            'port': result.port,
            'sslmode': 'require'
        }
    else:
        db_params = {
            "host": os.getenv("POSTGRES_HOST", "postgresfy"),
            "port": os.getenv("POSTGRES_PORT", "5432"),
            "database": os.getenv("POSTGRES_DB", "streamdb"),
            "user": os.getenv("POSTGRES_USER", "admin"),
            "password": os.getenv("POSTGRES_PASSWORD", "admin123"),
        }
        print(f"DB POOL CONNECTING TO (LOCAL): {db_params['host']}:{db_params['port']}")

    try:
        # Create a ThreadedConnectionPool
        # Min: 1, Max: 20
        pg_pool = pool.ThreadedConnectionPool(1, 20, **db_params)
        print("DB POOL INITIALIZED SUCCESSFULLY")
    except Exception as e:
        print(f"DB POOL INIT FAILED: {e}")

@contextmanager
def get_conn():
    global pg_pool
    if not pg_pool:
        init_pg_pool()
    
    conn = None
    try:
        if pg_pool:
            conn = pg_pool.getconn()
            yield conn
        else:
            # Fallback if pool failed (prevent crash)
            print("DB POOL UNAVAILABLE, USING FALLBACK CONNECTION")
            # Reconstruct params blindly for fallback? Or just fail?
            # Better to try init again or fail explicitly
            raise Exception("Database Connection Pool not initialized")
    finally:
        if pg_pool and conn:
            pg_pool.putconn(conn)

def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    spotify_id TEXT UNIQUE,
                    display_name TEXT,
                    refresh_token TEXT,
                    token_expires_at TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS artists (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    popularity INTEGER,
                    image_url TEXT
                );

                CREATE TABLE IF NOT EXISTS tracks (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    popularity INTEGER,
                    preview_url TEXT
                );

                CREATE TABLE IF NOT EXISTS user_tracks (
                    spotify_id TEXT,
                    track_id TEXT,
                    PRIMARY KEY (spotify_id, track_id),
                    FOREIGN KEY (spotify_id) REFERENCES users(spotify_id) ON DELETE CASCADE,
                    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS user_artists (
                    spotify_id TEXT,
                    artist_id TEXT,
                    PRIMARY KEY (spotify_id, artist_id),
                    FOREIGN KEY (spotify_id) REFERENCES users(spotify_id) ON DELETE CASCADE,
                    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
                );
            """)
            conn.commit()

def save_user(spotify_id, display_name):
    # PRIMARY: Write to Neon (blocking, must succeed)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (spotify_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (spotify_id) DO UPDATE SET display_name = EXCLUDED.display_name
            """, (spotify_id, display_name))
            conn.commit()
    
    # SECONDARY: Write to Supabase (async, fire-and-forget)
    async_write_to_supabase("""
        INSERT INTO users (spotify_id, display_name)
        VALUES (%s, %s)
        ON CONFLICT (spotify_id) DO UPDATE SET display_name = EXCLUDED.display_name
    """, (spotify_id, display_name))

def save_refresh_token(spotify_id, refresh_token, expires_at):
    """Save refresh token and expiry time for a user."""
    # PRIMARY: Write to Neon (blocking)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users 
                SET refresh_token = %s, token_expires_at = %s
                WHERE spotify_id = %s
            """, (refresh_token, expires_at, spotify_id))
            conn.commit()
    
    # SECONDARY: Write to Supabase (async)
    async_write_to_supabase("""
        UPDATE users 
        SET refresh_token = %s, token_expires_at = %s
        WHERE spotify_id = %s
    """, (refresh_token, expires_at, spotify_id))

def get_refresh_token(spotify_id):
    """Retrieve refresh token for a user."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT refresh_token FROM users WHERE spotify_id = %s
            """, (spotify_id,))
            result = cur.fetchone()
            return result[0] if result else None

def save_artist(artist_id, name, popularity, image_url):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO artists (id, name, popularity, image_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    popularity = EXCLUDED.popularity,
                    image_url = EXCLUDED.image_url
            """, (artist_id, name, popularity, image_url))
            conn.commit()

def save_track(track_id, name, popularity, preview_url):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tracks (id, name, popularity, preview_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    popularity = EXCLUDED.popularity,
                    preview_url = EXCLUDED.preview_url
            """, (track_id, name, popularity, preview_url))
            conn.commit()

def save_user_track(spotify_id, track_id):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_tracks (spotify_id, track_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (spotify_id, track_id))
            conn.commit()

def save_user_artist(spotify_id, artist_id):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_artists (spotify_id, artist_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (spotify_id, artist_id))
            conn.commit()

def save_artists_batch(artists_data):
    """Menyimpan banyak artis sekaligus."""
    if not artists_data: return
    
    # PRIMARY: Write to Neon
    with get_conn() as conn:
        with conn.cursor() as cur:

            execute_values(cur, """
                INSERT INTO artists (id, name, popularity, image_url)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    popularity = EXCLUDED.popularity,
                    image_url = EXCLUDED.image_url
            """, artists_data)
            conn.commit()
    
    # SECONDARY: Write to Supabase (async)
    async_batch_write_to_supabase("""
        INSERT INTO artists (id, name, popularity, image_url)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            popularity = EXCLUDED.popularity,
            image_url = EXCLUDED.image_url
    """, artists_data)

def save_tracks_batch(tracks_data):
    """Menyimpan banyak lagu sekaligus."""
    if not tracks_data: return
    
    # PRIMARY: Write to Neon
    with get_conn() as conn:
        with conn.cursor() as cur:

            execute_values(cur, """
                INSERT INTO tracks (id, name, popularity, preview_url)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    popularity = EXCLUDED.popularity,
                    preview_url = EXCLUDED.preview_url
            """, tracks_data)
            conn.commit()
    
    # SECONDARY: Write to Supabase (async)
    async_batch_write_to_supabase("""
        INSERT INTO tracks (id, name, popularity, preview_url)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            popularity = EXCLUDED.popularity,
            preview_url = EXCLUDED.preview_url
    """, tracks_data)

def save_user_associations_batch(table_name, column_name, spotify_id, item_ids):
    if not item_ids: return
    with get_conn() as conn:
        with conn.cursor() as cur:

            data_to_insert = [(spotify_id, item_id) for item_id in item_ids]
            execute_values(cur, f"""
                INSERT INTO {table_name} (spotify_id, {column_name})
                VALUES %s
                ON CONFLICT DO NOTHING
            """, data_to_insert)
            conn.commit()

def get_aggregate_stats():
    stats = {}
    with get_conn() as conn:
        with conn.cursor() as cur:

            cur.execute("SELECT COUNT(*) FROM users")
            stats["total_users"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM artists")
            stats["total_unique_artists"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM tracks")
            stats["total_unique_tracks"] = cur.fetchone()[0]

            cur.execute("SELECT name, popularity FROM artists ORDER BY popularity DESC LIMIT 5")
            stats["most_popular_artists"] = [f"{name} (Pop: {pop})" for name, pop in cur.fetchall()]

            cur.execute("SELECT name, popularity FROM tracks ORDER BY popularity DESC LIMIT 5")
            stats["most_popular_tracks"] = [f"{name} (Pop: {pop})" for name, pop in cur.fetchall()]

    return stats

def get_user_db_details(spotify_id: str):
    details = {}
    with get_conn() as conn:
        with conn.cursor() as cur:

            cur.execute("SELECT display_name FROM users WHERE spotify_id = %s", (spotify_id,))
            user_result = cur.fetchone()
            if not user_result:
                raise Exception(f"User with spotify_id '{spotify_id}' not found in database.")
            details["display_name"] = user_result[0]
            details["spotify_id"] = spotify_id

            cur.execute("""
                SELECT a.name, a.popularity
                FROM artists a
                JOIN user_artists ua ON a.id = ua.artist_id
                WHERE ua.spotify_id = %s
                ORDER BY a.popularity DESC
                LIMIT 5
            """, (spotify_id,))
            details["db_top_artists"] = [f"{name} (Pop: {pop})" for name, pop in cur.fetchall()]

            cur.execute("""
                SELECT t.name, t.popularity
                FROM tracks t
                JOIN user_tracks ut ON t.id = ut.track_id
                WHERE ut.spotify_id = %s
                ORDER BY t.popularity DESC
                LIMIT 5
            """, (spotify_id,))
            details["db_top_tracks"] = [f"{name} (Pop: {pop})" for name, pop in cur.fetchall()]

    return details

import requests
import json
import threading
from datetime import datetime, timedelta, timezone
import os

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

def _send_log_direct(level, message, source):
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return 

    try:
        wib = timezone(timedelta(hours=7))
        timestamp = datetime.now(wib).strftime("%H:%M:%S")

        log_entry = f"[{level}] {source}: {message} | {timestamp}"

        requests.post(
            UPSTASH_URL,
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            json=["RPUSH", "system:logs", log_entry],
            timeout=1
        )

        requests.post(
            UPSTASH_URL,
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
            json=["LTRIM", "system:logs", -100, -1],
            timeout=1
        )
    except Exception as e:
        print(f"LOG ERROR: {e}")

def log_system(level, message, source="BACKEND"):

    print(f"[{level}] {source}: {message}")

    threading.Thread(target=_send_log_direct, args=(level, message, source)).start()