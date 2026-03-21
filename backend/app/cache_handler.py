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

def clear_user_cache(spotify_id):
    """Deletes all cached dashboard terms for a specific user to force a fresh sync on next login."""
    try:
        count = 0
        for term in ["short_term", "medium_term", "long_term"]:
            key = f"top_v2:{spotify_id}:{term}"
            if r.delete(key):
                count += 1
        
        # Also clear profile cache 
        if r.delete(f"profile:{spotify_id}"):
            count += 1
            
        print(f"CACHE_HANDLER: Cleared {count} cache keys for {spotify_id}")
        return count
    except Exception as e:
        print(f"CACHE_HANDLER ERROR Clearing User {spotify_id}: {e}")
        return 0

def hard_clear_user_cache(spotify_id):
    """
    HARD CLEAR: wipes dashboard cache + ALL NLP analysis results (analysis_v1:*).
    NLP cache is track-keyed (not user-keyed) so this affects all cached tracks globally,
    forcing full re-analysis on next login. Called on logout and on fresh login.
    """
    count = clear_user_cache(spotify_id)
    
    # Wipe all NLP analysis cache entries (forces fresh re-analysis on next login)
    try:
        nlp_keys = list(r.scan_iter("analysis_v1:*"))
        if nlp_keys:
            r.delete(*nlp_keys)
            count += len(nlp_keys)
            print(f"CACHE_HANDLER: Hard clear — wiped {len(nlp_keys)} NLP analysis keys.")
    except Exception as e:
        print(f"CACHE_HANDLER HARD CLEAR ERROR: {e}")
    
    print(f"CACHE_HANDLER: Hard clear total: {count} keys wiped for {spotify_id}")
    return count

def get_analysis_cache(display_name):
    """Retrieve individual track analysis (emotions, mbti) from Redis."""
    try:
        key = f"analysis_v1:{display_name.lower().strip()}"
        cached = r.get(key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        print(f"CACHE_HANDLER ERROR: get_analysis_cache failed: {e}")
    return None

def set_analysis_cache(display_name, data, ttl=604800): # 7 days
    """Store individual track analysis results in Redis."""
    try:
        key = f"analysis_v1:{display_name.lower().strip()}"
        r.setex(key, ttl, json.dumps(data))
    except Exception as e:
        print(f"CACHE_HANDLER ERROR: set_analysis_cache failed: {e}")

def get_image_cache(artist_name):
    """Retrieve scraped artist image from Redis."""
    try:
        key = f"img_v3:{artist_name.lower().strip()}"
        return r.get(key)
    except:
        return None

def set_image_cache(artist_name, img_url, ttl=604800): # 7 days
    """Store scraped artist image in Redis."""
    try:
        key = f"img_v3:{artist_name.lower().strip()}"
        r.setex(key, ttl, img_url)
    except:
        pass