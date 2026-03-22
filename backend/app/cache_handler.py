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
            key = f"top:{spotify_id}:{term}"
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
    NUCLEAR CLEAR: wipes:
    1. User dashboard cache (top:*)
    2. User profile (profile:*)
    3. GLOBAL NLP analysis results (analysis:*)
    4. GLOBAL Artist image cache (img:*)
    
    This ensures a 100% fresh start for the user, resolving "stubborn" cache issues.
    """
    count = clear_user_cache(spotify_id)
    
    # 1. Wipe all NLP analysis cache entries (forces fresh re-analysis on next login)
    try:
        nlp_keys = list(r.scan_iter("analysis:*"))
        if nlp_keys:
            r.delete(*nlp_keys)
            count += len(nlp_keys)
            print(f"CACHE_HANDLER: Nuclear clear — wiped {len(nlp_keys)} NLP analysis keys.")
    except Exception as e:
        print(f"CACHE_HANDLER HARD CLEAR ERROR (NLP): {e}")

    # 2. Wipe all GLOBAL Artist image cache entries (forces fresh scraping/verification)
    try:
        img_keys = list(r.scan_iter("img:*"))
        if img_keys:
            r.delete(*img_keys)
            count += len(img_keys)
            print(f"CACHE_HANDLER: Nuclear clear — wiped {len(img_keys)} Image cache keys.")
    except Exception as e:
        print(f"CACHE_HANDLER HARD CLEAR ERROR (IMG): {e}")
    
    print(f"CACHE_HANDLER: Nuclear clear total: {count} keys wiped.")
    return count

def get_analysis_cache(display_name):
    """Retrieve individual track analysis (emotions, mbti) from Redis."""
    try:
        key = f"analysis:{display_name.lower().strip()}"
        cached = r.get(key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        print(f"CACHE_HANDLER ERROR: get_analysis_cache failed: {e}")
    return None

def set_analysis_cache(display_name, data, ttl=604800): # 7 days
    """Store individual track analysis results in Redis."""
    try:
        key = f"analysis:{display_name.lower().strip()}"
        r.setex(key, ttl, json.dumps(data))
    except Exception as e:
        print(f"CACHE_HANDLER ERROR: set_analysis_cache failed: {e}")

def get_image_cache(artist_name):
    """Retrieve scraped artist image from Redis."""
    try:
        key = f"img:{artist_name.lower().strip()}"
        return r.get(key)
    except:
        return None

def set_image_cache(artist_name, img_url, ttl=604800): # 7 days
    """Store scraped artist image in Redis."""
    try:
        key = f"img:{artist_name.lower().strip()}"
        r.setex(key, ttl, img_url)
    except:
        pass

# Known bad placeholder hashes from Last.fm (generic background images)
_KNOWN_BAD_IMAGE_SUBSTRINGS = [
    "2a96cbd8b46e442fc41c2b86b821562f",  # Last.fm default artist
    "4128a6eb29f94943c9d206c08e625904",  # Last.fm default track
    "__NOT_FOUND__",
    "blank-profile-picture",
    "default_artist",
    "placeholder",
    "data:image",
    "818148bf682d429dc215c1705eb27b98",  # Last.fm alternate default (star/silhouette)
    "000000-80-0-0",  # Deezer generic empty
    "561d5fbcde",     # Deezer alternate empty hash
    "images/artist//" # Deezer empty ID path
]

def is_bad_image(url: str) -> bool:
    """Return True if the URL points to a known placeholder or broken image."""
    if not url:
        return True
    return any(bad in url for bad in _KNOWN_BAD_IMAGE_SUBSTRINGS)

def get_valid_image_cache(artist_name: str) -> str | None:
    """Retrieve image from cache ONLY if it's not a known placeholder."""
    cached = get_image_cache(artist_name)
    if cached and not is_bad_image(cached):
        return cached
    return None