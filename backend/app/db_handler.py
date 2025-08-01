# backend/app/db_handler.py

import os
import psycopg2
from dotenv import load_dotenv
from urllib.parse import urlparse

# Memuat .env agar tetap berfungsi di lokal
load_dotenv()

# --- BLOK KODE BARU UNTUK KONEKSI PINTAR ---
DB_PARAMS = {}
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Jika ada DATABASE_URL (saat di Zeabur), kita "bongkar" isinya
    result = urlparse(DATABASE_URL)
    DB_PARAMS = {
        "host": result.hostname,
        "port": result.port,
        "user": result.username,
        "password": result.password,
        # --- INI PERUBAHAN KUNCINYA ---
        # Kita paksa nama database-nya menjadi 'streamdb', mengabaikan nama default dari Zeabur
        "database": os.getenv("POSTGRES_DB", "streamdb"),
    }
else:
    # Jika tidak ada (saat di lokal), pakai .env seperti biasa
    DB_PARAMS = {
        "host": os.getenv("POSTGRES_HOST"),
        "port": os.getenv("POSTGRES_PORT"),
        "database": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
    }
# --- AKHIR BLOK KODE BARU ---


# SISA KODE DI BAWAH INI SAMA PERSIS SEPERTI KODE ANDA
def get_conn():
    return psycopg2.connect(**DB_PARAMS)

def init_db():
    # Membuat koneksi ke database yang spesifik ('streamdb')
    conn_params = DB_PARAMS.copy()
    initial_db_name = conn_params.pop('database') # Ambil nama db
    conn = psycopg2.connect(**conn_params)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Cek apakah database sudah ada, jika tidak, buat
    cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{initial_db_name}'")
    if not cur.fetchone():
        cur.execute(f"CREATE DATABASE {initial_db_name}")
    
    cur.close()
    conn.close()

    # Sekarang hubungkan ke database 'streamdb' untuk membuat tabel
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

# --- Sisa fungsi (save_user, dll.) tidak perlu diubah ---
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