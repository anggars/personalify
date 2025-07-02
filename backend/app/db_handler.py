import psycopg2
import os

DB_PARAMS = {
    "host": os.getenv("POSTGRES_HOST", "postgresfy"),
    "port": os.getenv("POSTGRES_PORT", "5432"),
    "database": os.getenv("POSTGRES_DB", "streamdb"),
    "user": os.getenv("POSTGRES_USER", "admin"),
    "password": os.getenv("POSTGRES_PASSWORD", "admin123"),
}

def get_conn():
    return psycopg2.connect(**DB_PARAMS)

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
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (artist_id, name, popularity, image_url))
            conn.commit()

def save_track(track_id, name, popularity, preview_url):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tracks (id, name, popularity, preview_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
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
