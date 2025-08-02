import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# --- BLOK KODE BARU UNTUK KONEKSI PINTAR ---
# Kode ini akan memprioritaskan DATABASE_URL (dari Render),
# dan fallback ke variabel biasa jika di lokal.
DB_PARAMS = {}
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Jika ada DATABASE_URL (saat di Render), langsung gunakan itu.
    # psycopg2 bisa langsung menerima URL ini.
    DB_PARAMS['dsn'] = DATABASE_URL
else:
    # Jika tidak ada (saat di lokal), pakai .env seperti biasa
    DB_PARAMS = {
        "host": os.getenv("POSTGRES_HOST"),
        "port": os.getenv("POSTGRES_PORT"),
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
    }

def get_conn():
    return psycopg2.connect(**DB_PARAMS)

# ... sisa kode Anda (init_db, save_user, dll.)

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
