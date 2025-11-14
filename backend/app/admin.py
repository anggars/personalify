import os
from app.db_handler import get_aggregate_stats # (Ini fungsi baru, kita buat di Langkah 2)
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