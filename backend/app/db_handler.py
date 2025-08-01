import psycopg2
import os
from dotenv import load_dotenv

# Memuat .env agar tetap berfungsi di lokal
load_dotenv()

# --- BLOK KONEKSI PINTAR (FINAL) ---
# Kode ini akan membaca variabel dari Zeabur (PG...) atau dari .env lokal (POSTGRES_...)
DB_PARAMS = {
    "host": os.getenv("PGHOST", os.getenv("POSTGRES_HOST")),
    "port": os.getenv("PGPORT", os.getenv("POSTGRES_PORT")),
    "dbname": os.getenv("PGDATABASE", os.getenv("POSTGRES_DB")),
    "user": os.getenv("PGUSER", os.getenv("POSTGRES_USER")),
    "password": os.getenv("PGPASSWORD", os.getenv("POSTGRES_PASSWORD")),
}

def get_conn():
    """Fungsi ini kembali ke versi asli Anda yang simpel."""
    return psycopg2.connect(**DB_PARAMS)

def init_db():
    """
    Fungsi ini ditingkatkan untuk secara otomatis MEMBUAT DATABASE jika belum ada,
    sebelum mencoba membuat tabel. Ini menyelesaikan error "database does not exist".
    """
    try:
        # Coba hubungkan ke database yang spesifik
        conn = get_conn()
        conn.close()
    except psycopg2.OperationalError as e:
        # Jika error karena database tidak ada, kita buat databasenya
        if f'database "{DB_PARAMS["dbname"]}" does not exist' in str(e):
            conn_params_for_creation = DB_PARAMS.copy()
            db_to_create = conn_params_for_creation.pop("dbname")
            
            # Hubungkan ke database default 'postgres' untuk bisa membuat db baru
            conn_params_for_creation['dbname'] = 'postgres'
            conn = psycopg2.connect(**conn_params_for_creation)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(f"CREATE DATABASE {db_to_create}")
            cur.close()
            conn.close()
        else:
            # Jika error lain, tetap tampilkan
            raise e

    # Sekarang hubungkan ke database yang sudah pasti ada untuk membuat tabel
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


# --- SEMUA FUNGSI DI BAWAH INI ADALAH MILIK ANDA, TANPA PERUBAHAN ---

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