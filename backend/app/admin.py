import os
import csv
import io
from app.db_handler import get_aggregate_stats, get_user_db_details, get_conn # (Ini fungsi baru, kita buat di Langkah 2)
from app.mongo_handler import get_all_synced_user_ids # (Ini fungsi baru, kita buat di Langkah 3)
from app.cache_handler import r as redis_client # Import koneksi Redis yang ada

def get_system_wide_stats():
    """
    Fungsi utama untuk mengumpulkan statistik dari semua database.
    Ini adalah 100% logika Python murni.
    """
    print("ADMIN_STATS: Mengumpulkan data statistik...")
    
    # 1. Ambil statistik agregat dari PostgreSQL
    try:
        db_stats = get_aggregate_stats()
        print(f"ADMIN_STATS: Berhasil mendapat data dari PostgreSQL.")
    except Exception as e:
        print(f"ADMIN_STATS: Gagal mengambil data PostgreSQL: {e}")
        db_stats = {
            "error_postgres": str(e),
            "total_users": -1,
            "total_unique_artists": -1,
            "total_unique_tracks": -1,
            "most_popular_artists": [],
            "most_popular_tracks": []
        }

    # 2. Ambil statistik dari MongoDB
    try:
        mongo_users = get_all_synced_user_ids()
        db_stats["mongo_synced_users_count"] = len(mongo_users)
        db_stats["mongo_synced_user_list"] = mongo_users
        print(f"ADMIN_STATS: Berhasil mendapat data dari MongoDB.")
    except Exception as e:
        print(f"ADMIN_STATS: Gagal mengambil data MongoDB: {e}")
        db_stats["mongo_synced_users_count"] = -1
        db_stats["mongo_synced_user_list"] = [f"Error: {e}"]

    # 3. Ambil statistik dari Redis
    try:
        # Gunakan 'scan' untuk performa lebih baik, tapi 'keys' lebih simpel di sini
        redis_keys = redis_client.keys("top:*:*")
        db_stats["redis_cached_keys_count"] = len(redis_keys)
        
        db_stats["redis_sample_keys"] = redis_keys[:5]
        
        print(f"ADMIN_STATS: Berhasil mendapat data dari Redis.")
    except Exception as e:
        print(f"ADMIN_STATS: Gagal mengambil data Redis: {e}")
        db_stats["redis_cached_keys_count"] = -1
        db_stats["redis_sample_keys"] = [f"Error: {e}"]

    print("ADMIN_STATS: Selesai mengumpulkan data.")
    return db_stats

def get_user_report(spotify_id: str):
    """
    Mengambil data laporan untuk satu user spesifik.
    """
    print(f"ADMIN_STATS: Mengambil laporan untuk user: {spotify_id}")
    try:
        user_details = get_user_db_details(spotify_id)
        print(f"ADMIN_STATS: Berhasil mendapat data user {spotify_id} from PostgreSQL.")
        return user_details
    except Exception as e:
        print(f"ADMIN_STATS: Gagal mengambil data user {spotify_id}: {e}")
        return {
            "error": str(e),
            "spotify_id": spotify_id,
            "display_name": "N/A",
            "db_top_artists": [],
            "db_top_tracks": []
        }
        
def export_users_to_csv():
    """
    Fungsi Admin: Export data user LENGKAP dengan Top Artists & Tracks
    dari PostgreSQL ke format CSV (Lightweight/Tanpa Pandas).
    """
    print("ADMIN: Memulai export data users (Full Detail Mode)...")
    
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        
        with get_conn() as conn:
            with conn.cursor() as cur:
                # QUERY RAHASIA: Menggunakan Subquery & String Aggregation
                # Biar 1 User tetap 1 Baris, tapi kolomnya kaya data.
                query = """
                SELECT 
                    u.id, 
                    u.spotify_id, 
                    u.display_name,
                    -- Ambil Top 10 Artis, gabung jadi satu string dipisah koma
                    COALESCE(
                        (SELECT STRING_AGG(a.name, ' | ') 
                         FROM (
                             SELECT ar.name 
                             FROM user_artists ua 
                             JOIN artists ar ON ua.artist_id = ar.id 
                             WHERE ua.spotify_id = u.spotify_id
                             LIMIT 10
                         ) a), 
                    'No Data') as top_artists_list,
                    
                    -- Ambil Top 10 Lagu, gabung jadi satu string
                    COALESCE(
                        (SELECT STRING_AGG(t.name, ' | ') 
                         FROM (
                             SELECT tr.name 
                             FROM user_tracks ut 
                             JOIN tracks tr ON ut.track_id = tr.id 
                             WHERE ut.spotify_id = u.spotify_id
                             LIMIT 10
                         ) t), 
                    'No Data') as top_tracks_list
                    
                FROM users u
                ORDER BY u.id ASC;
                """
                
                cur.execute(query)
                
                # 1. Tulis Header Manual (karena query kompleks, description kadang beda)
                headers = ["ID", "Spotify ID", "Display Name", "Top 10 Artists", "Top 10 Tracks"]
                writer.writerow(headers)
                
                # 2. Tulis Data
                while True:
                    rows = cur.fetchmany(1000)
                    if not rows:
                        break
                    writer.writerows(rows)
        
        csv_string = output.getvalue()
        output.close()
        
        print(f"ADMIN: Export selesai.")
        return csv_string

    except Exception as e:
        print(f"ADMIN: Gagal export csv: {e}")
        return str(e)