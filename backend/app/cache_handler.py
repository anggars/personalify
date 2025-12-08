import redis
import json
import os
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")

if REDIS_URL:

    print(f"CACHE HANDLER: CONNECTING TO CLOUD REDIS VIA URL.")
    r = redis.from_url(REDIS_URL, decode_responses=True)
else:

    redis_host = os.getenv("REDIS_HOST", "redisfy")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    print(f"CACHE HANDLER: CONNECTING TO LOCAL REDIS AT {redis_host}:{redis_port}.")
    r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

def cache_top_data(key_prefix, spotify_id, term, data, ttl=3600):
    key = f"{key_prefix}:{spotify_id}:{term}"
    r.setex(key, ttl, json.dumps(data))

def get_cached_top_data(key_prefix, spotify_id, term):
    key = f"{key_prefix}:{spotify_id}:{term}"
    cached_data = r.get(key)
    if cached_data:
        return json.loads(cached_data)
    return None

def clear_top_data_cache():
    print("CACHE_HANDLER: STARTING TO CLEAR CACHE 'TOP:*:*'...")
    keys_to_delete = []

    for key in r.scan_iter("top:*:*"):
        keys_to_delete.append(key)

    if not keys_to_delete:
        print("CACHE_HANDLER: NO 'TOP:*:*' CACHE FOUND.")
        return 0 

    pipe = r.pipeline()
    for key in keys_to_delete:
        pipe.delete(key)
    pipe.execute()

    print(f"CACHE_HANDLER: DONE. {len(keys_to_delete)} CACHE ENTRIES DELETED.")
    return len(keys_to_delete) 