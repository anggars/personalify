# backend/app/db_handler.py

import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from contextlib import contextmanager
from dotenv import load_dotenv

# Memuat .env agar tetap berfungsi di lokal
load_dotenv()

# Variabel global untuk connection pool
pool = None

def init_db_pool():
    """
    Menginisialisasi connection pool.
    Fungsi ini cerdas: ia akan menggunakan DATABASE_URL jika ada (untuk produksi),
    atau menggunakan variabel terpisah jika tidak ada (untuk lokal).
    """
    global pool
    
    # Prioritaskan DATABASE_URL untuk lingkungan produksi (seperti Zeabur)
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        # Menambahkan sslmode='require' seringkali diperlukan di platform cloud
        if 'sslmode' not in database_url:
            database_url += "?sslmode=require"
        pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=database_url)
    else:
        # Fallback untuk development lokal menggunakan variabel terpisah dari .env
        dsn = (
            f"host={os.getenv('POSTGRES_HOST')} "
            f"port={os.getenv('POSTGRES_PORT')} "
            f"dbname={os.getenv('POSTGRES_DB')} "
            f"user={os.getenv('POSTGRES_USER')} "
            f"password={os.getenv('POSTGRES_PASSWORD')}"
        )
        pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=dsn)

@contextmanager
def get_conn():
    """Mengambil koneksi dari pool dan mengembalikannya secara otomatis."""
    if pool is None:
        raise Exception("Connection pool is not initialized. Call init_db_pool() on startup.")
    
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)

def create_tables():
    """Membuat tabel jika belum ada."""
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

# --- Fungsi-fungsi lain tetap sama, hanya memanggil get_conn ---

def save_user(spotify_id, display_name):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (spotify_id, display_name) VALUES (%s, %s)
                ON CONFLICT (spotify_id) DO UPDATE SET display_name = EXCLUDED.display_name
            """, (spotify_id, display_name))
            conn.commit()

def save_artist(artist_id, name, popularity, image_url):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO artists (id, name, popularity, image_url) VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, popularity = EXCLUDED.popularity, image_url = EXCLUDED.image_url
            """, (artist_id, name, popularity, image_url))
            conn.commit()

def save_track(track_id, name, popularity, preview_url):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tracks (id, name, popularity, preview_url) VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, popularity = EXCLUDED.popularity, preview_url = EXCLUDED.preview_url
            """, (track_id, name, popularity, preview_url))
            conn.commit()

def save_user_track(spotify_id, track_id):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_tracks (spotify_id, track_id) VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (spotify_id, track_id))
            conn.commit()

def save_user_artist(spotify_id, artist_id):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_artists (spotify_id, artist_id) VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (spotify_id, artist_id))
            conn.commit()