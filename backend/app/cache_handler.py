import redis
import json
import os
from dotenv import load_dotenv

# Memuat .env agar tetap berfungsi di lokal
load_dotenv()

# --- BLOK KONEKSI PINTAR ---
REDIS_URL = os.getenv("REDIS_URL")

if REDIS_URL:
    # Jika ada REDIS_URL (saat di Render), gunakan itu
    r = redis.from_url(REDIS_URL, decode_responses=True)
else:
    # Jika tidak ada (saat di lokal), gunakan host dan port dari .env
    redis_host = os.getenv("REDIS_HOST", "redisfy")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)


def cache_top_data(key_prefix, spotify_id, term, data, ttl=3600):
    """
    Menyimpan data top (artists/tracks) ke cache Redis.
    TTL (Time-to-live) dalam detik, default 1 jam.
    """
    key = f"{key_prefix}:{spotify_id}:{term}"
    r.setex(key, ttl, json.dumps(data))

def get_cached_top_data(key_prefix, spotify_id, term):
    """
    Mengambil data top dari cache Redis.
    """
    key = f"{key_prefix}:{spotify_id}:{term}"
    cached_data = r.get(key)
    if cached_data:
        return json.loads(cached_data)
    return None

def clear_top_data_cache():
    """
    Menghapus semua cache 'top:*' dari Redis.
    Menggunakan SCAN_ITER agar aman dan tidak memblokir server.
    """
    print("CACHE_HANDLER: Memulai pembersihan cache 'top:*:*'...")
    keys_to_delete = []
    # 'r' adalah klien redis.Redis(decode_responses=True) yang sudah ada
    for key in r.scan_iter("top:*:*"):
        keys_to_delete.append(key)
    
    if not keys_to_delete:
        print("CACHE_HANDLER: Tidak ada cache 'top:*:*' yang ditemukan.")
        return 0 # 0 keys deleted
    
    # Gunakan pipeline untuk menghapus secara efisien
    pipe = r.pipeline()
    for key in keys_to_delete:
        pipe.delete(key)
    pipe.execute()
    
    print(f"CACHE_HANDLER: Selesai. {len(keys_to_delete)} cache telah dihapus.")
    return len(keys_to_delete) # Mengembalikan jumlah cache yang dihapus