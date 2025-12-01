import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import execute_values
from urllib.parse import urlparse
from contextlib import contextmanager
from dotenv import load_dotenv

# Load .env jika dijalankan di lokal
load_dotenv()

# Variabel Global untuk menampung Pool Koneksi
pg_pool = None

def init_db_pool():
    """
    Inisialisasi Connection Pool.
    Hanya dijalankan sekali saat pertama kali koneksi dibutuhkan.
    """
    global pg_pool
    
    # Cek jika pool sudah ada, tidak perlu buat lagi
    if pg_pool:
        return

    DATABASE_URL = os.getenv("DATABASE_URL")

    # Parameter agar koneksi tidak mudah putus (Keep-Alive)
    conn_params = {
        "minconn": 1,
        "maxconn": 5,  # Maksimal 5 koneksi standby (cukup untuk lokal)
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
        "connect_timeout": 10
    }

    print("DB HANDLER: Menginisialisasi Connection Pool...")

    try:
        if DATABASE_URL:
            # Mode Cloud (Supabase via URL)
            result = urlparse(DATABASE_URL)
            pg_pool = psycopg2.pool.ThreadedConnectionPool(
                user=result.username,
                password=result.password,
                host=result.hostname,
                port=result.port,
                database=result.path[1:],
                sslmode='require', # Wajib untuk Supabase
                **conn_params
            )
        else:
            # Mode Docker Lokal
            pg_pool = psycopg2.pool.ThreadedConnectionPool(
                user=os.getenv("POSTGRES_USER", "admin"),
                password=os.getenv("POSTGRES_PASSWORD", "admin123"),
                host=os.getenv("POSTGRES_HOST", "postgresfy"),
                port=os.getenv("POSTGRES_PORT", "5432"),
                database=os.getenv("POSTGRES_DB", "streamdb"),
                **conn_params
            )
        print("DB HANDLER: Connection Pool siap digunakan.")
        
    except Exception as e:
        print(f"DB HANDLER ERROR (Init Pool): {e}")
        # Kita tidak raise error di sini agar app tetap jalan, 
        # error akan muncul saat get_conn dipanggil.

@contextmanager
def get_conn():
    """
    Mengambil satu koneksi dari pool, menggunakannya, 
    dan MENGEMBALIKANNYA ke pool setelah selesai (yield).
    """
    global pg_pool
    if not pg_pool:
        init_db_pool()

    conn = None
    try:
        # Pinjam koneksi dari pool
        conn = pg_pool.getconn()
        yield conn
    except Exception as e:
        print(f"DB HANDLER ERROR (Query): {e}")
        # Jika ada error, rollback transaksi agar koneksi 'bersih' saat dikembalikan
        if conn:
            conn.rollback()
        raise e
    finally:
        # Kembalikan koneksi ke pool (WAJIB)
        if conn:
            pg_pool.putconn(conn)

def init_db():
    """Membuat tabel jika belum ada."""
    try:
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
                print("DB HANDLER: Tabel database berhasil diinisialisasi.")
    except Exception as e:
        print(f"DB HANDLER ERROR (Init DB): {e}")

# --- FUNGSI CRUD (Tidak berubah logika, hanya menggunakan get_conn yang baru) ---

def save_user(spotify_id, display_name):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (spotify_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (spotify_id) DO UPDATE SET display_name = EXCLUDED.display_name
            """, (spotify_id, display_name))
            conn.commit()

def save_artists_batch(artists_data):
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
            valid_tables = {"user_tracks", "user_artists"}
            valid_cols = {"track_id", "artist_id"}
            if table_name not in valid_tables or column_name not in valid_cols:
                return 
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