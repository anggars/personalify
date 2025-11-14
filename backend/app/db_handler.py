import os
import psycopg2
from psycopg2.extras import execute_values
from urllib.parse import urlparse

# Load .env hanya jika DATABASE_URL belum ada (biar di Render tidak override)
if not os.getenv("DATABASE_URL"):
    from dotenv import load_dotenv
    load_dotenv()

def get_conn():
    """
    Membuat koneksi database yang cerdas.
    Bisa menangani DATABASE_URL (untuk Render/Supabase)
    atau variabel terpisah (untuk Docker lokal).
    """
    DATABASE_URL = os.getenv("DATABASE_URL")

    if DATABASE_URL:
        # Jika ada DATABASE_URL, kita parse secara manual untuk Supabase
        result = urlparse(DATABASE_URL)
        db_params = {
            'dbname': result.path[1:],
            'user': result.username,
            'password': result.password,
            'host': result.hostname,
            'port': result.port
        }
        return psycopg2.connect(**db_params)
    else:
        # Jika tidak ada, gunakan variabel terpisah untuk lokal
        db_params = {
            "host": os.getenv("POSTGRES_HOST", "postgresfy"),
            "port": os.getenv("POSTGRES_PORT", "5432"),
            "database": os.getenv("POSTGRES_DB", "streamdb"),
            "user": os.getenv("POSTGRES_USER", "admin"),
            "password": os.getenv("POSTGRES_PASSWORD", "admin123"),
        }
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
            # Kolom: id, name, popularity, image_url
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
            # Kolom: id, name, popularity, preview_url
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
    """Menyimpan banyak relasi user-lagu atau user-artis sekaligus."""
    if not item_ids: return
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Membuat data tuple (spotify_id, item_id)
            data_to_insert = [(spotify_id, item_id) for item_id in item_ids]
            execute_values(cur, f"""
                INSERT INTO {table_name} (spotify_id, {column_name})
                VALUES %s
                ON CONFLICT DO NOTHING
            """, data_to_insert)
            conn.commit()

def get_aggregate_stats():
    """
    Fungsi Python baru untuk mengambil statistik dari database PostgreSQL.
    """
    stats = {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            
            # Hitung total users
            cur.execute("SELECT COUNT(*) FROM users")
            stats["total_users"] = cur.fetchone()[0]
            
            # Hitung total artists
            cur.execute("SELECT COUNT(*) FROM artists")
            stats["total_unique_artists"] = cur.fetchone()[0]
            
            # Hitung total tracks
            cur.execute("SELECT COUNT(*) FROM tracks")
            stats["total_unique_tracks"] = cur.fetchone()[0]
            
            # Ambil 5 artis terpopuler di seluruh database
            cur.execute("SELECT name, popularity FROM artists ORDER BY popularity DESC LIMIT 5")
            stats["most_popular_artists"] = [f"{name} (Pop: {pop})" for name, pop in cur.fetchall()]
            
            # Ambil 5 track terpopuler di seluruh database
            cur.execute("SELECT name, popularity FROM tracks ORDER BY popularity DESC LIMIT 5")
            stats["most_popular_tracks"] = [f"{name} (Pop: {pop})" for name, pop in cur.fetchall()]
            
    return stats