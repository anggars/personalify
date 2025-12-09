import os
import psycopg2
from psycopg2.extras import execute_values
from urllib.parse import urlparse

if not os.getenv("DATABASE_URL"):
    from dotenv import load_dotenv
    load_dotenv()

def get_conn():
    DATABASE_URL = os.getenv("DATABASE_URL")

    if DATABASE_URL:

        result = urlparse(DATABASE_URL)
        print(f"DB CONNECTING TO (CLOUD): {result.hostname}:{result.port}")
        db_params = {
            'dbname': result.path[1:],
            'user': result.username,
            'password': result.password,
            'host': result.hostname,
            'port': result.port
        }
        return psycopg2.connect(**db_params)
    else:

        db_params = {
            "host": os.getenv("POSTGRES_HOST", "postgresfy"),
            "port": os.getenv("POSTGRES_PORT", "5432"),
            "database": os.getenv("POSTGRES_DB", "streamdb"),
            "user": os.getenv("POSTGRES_USER", "admin"),
            "password": os.getenv("POSTGRES_PASSWORD", "admin123"),
        }
        print(f"DB CONNECTING TO (LOCAL): {db_params['host']}:{db_params['port']}")
        return psycopg2.connect(**db_params)

def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    spotify_id TEXT UNIQUE,
                    display_name TEXT
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (spotify_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (spotify_id) DO UPDATE SET display_name = EXCLUDED.display_name
            """, (spotify_id, display_name))
            conn.commit()

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

def save_tracks_batch(tracks_data):
    """Menyimpan banyak lagu sekaligus."""
    if not tracks_data: return
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
from datetime import datetime

_VERCEL_URL = os.getenv("VERCEL_URL")
if _VERCEL_URL:
    _LOG_API_URL = f"https://{_VERCEL_URL}/api/log"
else:
    _LOG_API_URL = "http://localhost:3000/api/log"

def _send_log_background(level, message, source):
    try:
        payload = {
            "level": level,
            "message": message,
            "source": source
        }

        requests.post(_LOG_API_URL, json=payload, timeout=0.5)
    except:
        pass

def log_system(level, message, source="BACKEND"):

    print(f"[{level}] {source}: {message}")

    threading.Thread(target=_send_log_background, args=(level, message, source)).start()