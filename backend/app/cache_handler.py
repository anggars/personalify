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

# --- AKHIR BLOK KONEKSI PINTAR ---


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