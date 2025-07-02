import redis
import json
import os

redis_host = os.getenv("REDIS_HOST", "redisfy")
redis_port = int(os.getenv("REDIS_PORT", 6379))

r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

def cache_top_data(key_prefix, spotify_id, term, data):
    key = f"{key_prefix}:{spotify_id}:{term}"
    r.set(key, json.dumps(data))

def get_cached_top_data(key_prefix, spotify_id, term):
    key = f"{key_prefix}:{spotify_id}:{term}"
    data = r.get(key)
    return json.loads(data) if data else None
