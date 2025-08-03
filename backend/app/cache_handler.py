import redis
import json
import os

# --- BLOK KODE BARU ---
# Ambil REDIS_URL dari environment. Jika tidak ada (di lokal), 
# gunakan default 'redis://localhost:6379'.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Buat koneksi Redis menggunakan URL yang sudah ditentukan.
# decode_responses=True agar kita tidak perlu decode manual.
r = redis.from_url(REDIS_URL, decode_responses=True)
# --- AKHIR BLOK KODE BARU ---

def cache_top_data(key_prefix, spotify_id, term, data, ttl=3600):
    """
    Menyimpan data top (artists/tracks) ke cache Redis.
    TTL (Time-to-live) dalam detik, default 1 jam.
    """
    key = f"{key_prefix}:{spotify_id}:{term}"
    # r.setex sekarang akan menggunakan koneksi yang sudah benar
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