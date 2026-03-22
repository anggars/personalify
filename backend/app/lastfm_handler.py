import os
import requests
import hashlib
import base64
import time
from urllib.parse import quote_plus
from concurrent.futures import ThreadPoolExecutor
from app.db_handler import (
    save_user,
    save_artists_batch,
    save_tracks_batch,
    save_user_associations_batch
)
from app.cache_handler import cache_top_data, get_cached_top_data, get_valid_image_cache, is_bad_image, set_image_cache, delete_image_cache, get_image_cache
from app.mongo_handler import save_user_sync
from app.nlp_handler import generate_sentiment_analysis
from fastapi import BackgroundTasks

LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")
LASTFM_API_SECRET = os.getenv("LASTFM_API_SECRET")
LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/"

# Period mapping: Spotify time_range -> Last.fm period
PERIOD_MAP = {
    "short_term": "1month",
    "medium_term": "6month",
    "long_term": "12month"
}

# User requested lucide/disc-3 for tracks and lucide/users for artists with dark zinc styling and proportional padding
DEFAULT_TRACK_IMAGE = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%22-3%20-3%2030%2030%22%20fill%3D%22none%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20style%3D%22background-color%3A%2327272a%3B%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%2F%3E%3Cpath%20d%3D%22M6%2012c0-1.7.7-3.2%201.8-4.2%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%222%22%2F%3E%3Cpath%20d%3D%22M18%2012c0%201.7-.7%203.2-1.8%204.2%22%2F%3E%3C%2Fsvg%3E"
DEFAULT_ARTIST_IMAGE = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%22-3%20-3%2030%2030%22%20fill%3D%22none%22%20stroke%3D%22%23a1a1aa%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20style%3D%22background-color%3A%2327272a%3B%22%3E%3Cpath%20d%3D%22M16%2021v-2a4%204%200%200%200-4-4H6a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3Cpath%20d%3D%22M22%2021v-2a4%204%200%200%200-3-3.87%22%2F%3E%3Cpath%20d%3D%22M16%203.13a4%204%200%200%201%200%207.75%22%2F%3E%3C%2Fsvg%3E"

# --- HELPERS ---

def _search_spotify_artist_image(artist_name, token):
    """Fetch artist image using Spotify API with strict name verification."""
    if not token or not artist_name: return ""
    try:
        from urllib.parse import quote_plus
        # Get more results to find closer name match
        url = f"https://api.spotify.com/v1/search?q=artist:%22{quote_plus(artist_name)}%22&type=artist&limit=5"
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            items = data.get("artists", {}).get("items", [])
            target = artist_name.lower().strip()
            
            for artist in items:
                sp_name = artist.get("name", "").lower().strip()
                # STRICT EXACT MATCH ONLY to avoid "salah kaprah" (misguided) images
                if sp_name == target:
                    images = artist.get("images", [])
                    if images:
                        return images[0]["url"]
    except: pass
    return ""

def _is_valid_image(url: str) -> bool:
    """Enhanced validation: check for placeholders and minimum size (proxy via Content-Length)."""
    if not url or is_bad_image(url):
        return False
    # Only test size for valid-looking Last.fm/Spotify/Deezer images
    try:
        # Avoid heavy download; checking headers only
        res = requests.head(url, timeout=3, allow_redirects=True)
        # If Content-Length is provided, ensure it's > ~3000 bytes (rough proxy for 300x300 min)
        # We use 3000 bytes as a low threshold to discard 1x1 pixels or tiny icons.
        size = res.headers.get('Content-Length')
        if size and int(size) < 3000:
            return False
        return True
    except Exception:
        # If HEAD fails or timeouts, we accept it cautiously
        return True

# --- BACKGROUND PROCESSING ---

def process_lastfm_enhancement_background(username, time_range, result, extended=False, force_sync=False):
    """
    Background task to enhance Last.fm data with Spotify metadata,
    artist tags (genres), and sentiment analysis.
    """
    try:
        def _scrape_lastfm_artist_image(artist_name):
            """Robust Last.fm scraper using LD+JSON and flexible meta tags."""
            import re, json, html
            from urllib.parse import unquote
            try:
                url = f"https://www.last.fm/music/{quote_plus(artist_name)}"
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5"
                }
                res = requests.get(url, headers=headers, timeout=5)
                if res.status_code != 200:
                    return ""
                
                res_html = res.text
                
                # 1. Try LD+JSON (Most reliable)
                try:
                    ld_json_matches = re.findall(r'<script type="application/ld\+json">(.*?)</script>', res_html, re.DOTALL)
                    for ld_text in ld_json_matches:
                        data = json.loads(ld_text)
                        if isinstance(data, dict):
                            items = data if isinstance(data, list) else [data]
                            for item in items:
                                if item.get("@type") == "MusicGroup" and item.get("image"):
                                    return html.unescape(item["image"])
                except: pass

                # 2. Flexible Meta Tag Search
                meta_patterns = [
                    r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)["\']',
                    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\']'
                ]
                
                for pattern in meta_patterns:
                    matches = re.findall(pattern, res_html, re.IGNORECASE)
                    for img_url in matches:
                        clean_url = html.unescape(img_url)
                        # Filter out placeholders & generics
                        poisoned = ["2a96cbd8b46e442fc41c2b86b821562f", "avatar", "default_artist", "lastfm_logo", "placeholder"]
                        if not any(p in clean_url for p in poisoned):
                            return clean_url
                            
            except Exception as e:
                print(f"SCRAPE ERROR for {artist_name}: {e}")
            return ""

        def _scrape_lastfm_track_image(track_name, artist_name):
            """Fallback scraper to get track image from last.fm website without API limits."""
            from app.cache_handler import get_image_cache, set_image_cache
            cache_key = f"{artist_name}__{track_name}"
            cached_img = get_image_cache(cache_key)
            if cached_img:
                return "" if cached_img == "__NOT_FOUND__" else cached_img

            import re
            try:
                url = f"https://www.last.fm/music/{quote_plus(artist_name)}/_/{quote_plus(track_name)}"
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5"
                }
                res = requests.get(url, headers=headers, timeout=5)
                if res.status_code == 200:
                    matches = re.findall(r'<meta\s+(?:property|name)=[\'"](?:og:image|twitter:image)[\'"]\s+content=[\'"]([^\'"]+)[\'"]', res.text)
                    if not matches:
                         matches = re.findall(r'<meta\s+content=[\'"]([^\'"]+)[\'"]\s+(?:property|name)=[\'"](?:og:image|twitter:image)[\'"]', res.text)
                    
                    for img_url in matches:
                        if "2a96cbd8b46e442fc41c2b86b821562f" not in img_url and "avatar" not in img_url and "default" not in img_url:
                            set_image_cache(cache_key, img_url)
                            return img_url
            except Exception:
                pass
            return ""

        def _get_best_artist_image(idx, name, token, force_refresh=False):
            """Resolve artist image: Spotify → Last.fm → Deezer. Successful result cached in img."""
            if not force_refresh:
                cached = get_image_cache(name)
                if cached:
                    if not _is_valid_image(cached):
                        delete_image_cache(name)
                    else:
                        return idx, cached

            lfm_api_img = _get_artist_image(name)
            if _is_valid_image(lfm_api_img):
                set_image_cache(name, lfm_api_img)
                return idx, lfm_api_img

            if token:
                img = _search_spotify_artist_image(name, token)
                if img:
                    set_image_cache(name, img)
                    return idx, img

            img = _scrape_lastfm_artist_image(name)
            if _is_valid_image(img):
                set_image_cache(name, img)
                return idx, img

            img = _search_deezer_artist(name)
            if img:
                set_image_cache(name, img)
                return idx, img
            return idx, ""

        user_id = f"lastfm:{username}"
        print(f"LASTFM BG: Starting enhancement for '{username}'...")
        
        raw_artists = result.get("_raw_artists", [])
        raw_tracks = result.get("_raw_tracks", [])
        sp_token = _get_spotify_app_token()

        # 1. Fetch Artist Images
        artist_results_map = {}
        with ThreadPoolExecutor(max_workers=5) as executor:
            artist_futures = {
                executor.submit(_get_best_artist_image, i, a.get("name"), sp_token, force_refresh=force_sync): i 
                for i, a in enumerate(raw_artists)
            }
            from concurrent.futures import as_completed
            for future in as_completed(artist_futures):
                try:
                    res_idx, img_url = future.result()
                    if img_url:
                        artist_results_map[res_idx] = img_url
                except Exception as e:
                    print(f"LASTFM BG ARTIST IMAGE ERROR at index {artist_futures.get(future)}: {e}")

        # 1b. Fetch Track Images
        track_results_map = {}
        def _get_best_track_image(idx, t_name, a_name):
            sp_id, final_img = None, ""
            lfm_api_img = _get_track_image(a_name, t_name)
            if _is_valid_image(lfm_api_img):
                return idx, sp_id, lfm_api_img
            if sp_token:
                try:
                    sp_id, final_img = _search_spotify_track(t_name, a_name, sp_token)
                except Exception: pass
            if not final_img:
                try:
                    it_img = _search_itunes_track(t_name, a_name)
                    if _is_valid_image(it_img):
                        return idx, sp_id, it_img
                except Exception: pass
            if not final_img:
                try:
                    lfm_img = _scrape_lastfm_track_image(t_name, a_name)
                    if _is_valid_image(lfm_img):
                        return idx, sp_id, lfm_img
                except Exception: pass
            return idx, sp_id, final_img

        with ThreadPoolExecutor(max_workers=5) as executor:
            track_futures = {
                executor.submit(_get_best_track_image, i, t.get("name"), 
                                t.get("artist", {}).get("name") if isinstance(t.get("artist"), dict) else t.get("artist")
                               ): i 
                for i, t in enumerate(raw_tracks)
            }
            for future in as_completed(track_futures):
                try:
                    res_idx, sp_id, sp_img = future.result()
                    track_results_map[res_idx] = {"id": sp_id, "image": sp_img}
                except Exception as e:
                    print(f"LASTFM BG TRACK IMAGE ERROR at index {track_futures.get(future)}: {e}")

        # 2. Update Artists & Tracks
        enhanced_artists = result.get("artists", [])
        enhanced_tracks = result.get("tracks", [])
        
        for i, ra in enumerate(enhanced_artists):
            scraped_img = artist_results_map.get(i)
            if scraped_img and scraped_img.strip() and not is_bad_image(scraped_img):
                ra["image"] = scraped_img
            elif not ra.get("image") or is_bad_image(ra.get("image", "")):
                ra["image"] = ""
            
        for i, rt in enumerate(enhanced_tracks):
            sp_data = track_results_map.get(i, {})
            if sp_data.get("id"):
                rt["id"] = sp_data["id"]
            if sp_data.get("image") and sp_data.get("image").strip() and not is_bad_image(sp_data.get("image")):
                rt["image"] = sp_data["image"]
            elif not rt.get("image") or is_bad_image(rt.get("image", "")):
                rt["image"] = ""

        cache_top_data("top", user_id, time_range, result, ttl=60)

        # 3. Fetch Artist Tags
        genre_count = {}
        def _fetch_artist_genres(artist_name):
            try:
                tag_data = _lastfm_request("artist.getTopTags", {"artist": artist_name})
                if tag_data and "toptags" in tag_data:
                    tags = tag_data["toptags"].get("tag", [])
                    return [t.get("name", "").lower() for t in tags[:5]]
            except: pass
            return []

        with ThreadPoolExecutor(max_workers=5) as executor:
            artist_names = [a.get("name") for a in raw_artists[:15]]
            future_genres = {executor.submit(_fetch_artist_genres, name): name for name in artist_names}
            for future in as_completed(future_genres):
                artist_name = future_genres[future]
                try:
                    genres = future.result()
                    for g in genres:
                        if g not in ["seen live", "favorites", "favourite", "awesome", "scrobble", "alternative", "all", "amazing"]:
                            genre_count[g] = genre_count.get(g, 0) + 1
                    for ra in enhanced_artists:
                        if ra["name"] == artist_name:
                            ra["genres"] = genres
                            break
                except: continue

        sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
        result["genres"] = [{"name": name, "count": count} for name, count in sorted_genres[:20]]
        cache_top_data("top", user_id, time_range, result, ttl=300)
        save_user_sync(user_id, time_range, result)

        # 4. Sentiment Analysis
        from app.nlp_handler import generate_sentiment_analysis
        def sentiment_progress(msg):
             if isinstance(msg, dict):
                 cache_top_data("progress", user_id, time_range, msg, ttl=60)
                 report_str = f"Syncing ({msg['current']}/{msg['total']}): {msg['trackName'][:30]}..."
             else:
                 report_str = msg
             if "Syncing" in report_str or "Analyzing" in report_str:
                 if extended: result["extended_sentiment_report"] = report_str
                 else: result["sentiment_report"] = report_str
                 cache_top_data("top", user_id, time_range, result, ttl=300)
        
        sentiment_report, sentiment_scores = generate_sentiment_analysis(result["tracks"], progress_callback=sentiment_progress, extended=extended)
        if extended:
            result["extended_sentiment_report"] = sentiment_report
            result["extended_sentiment_scores"] = sentiment_scores
            result["extended_sentiment_count"] = 20
        else:
            result["sentiment_report"] = sentiment_report
            result["sentiment_scores"] = sentiment_scores
            result["sentiment_count"] = 10
        
        # Cleanup
        if "_raw_artists" in result: del result["_raw_artists"]
        if "_raw_tracks" in result: del result["_raw_tracks"]
        
        cache_top_data("top", user_id, time_range, result, ttl=3600)
        print(f"LASTFM BG: All enhancements complete for {user_id}")
        
    except Exception as e:
        import traceback
        err_msg = str(e)
        print(f"LASTFM BG ERROR: {err_msg}")
        traceback.print_exc()
        if 'result' in locals() and result:
            result["error_code"] = "enhancement_failed"
            result["error_detail"] = err_msg
            result["sentiment_report"] = f"Sync Failed: {err_msg[:50]}..."
            cache_top_data("top", user_id, time_range, result, ttl=300)


def process_lastfm_sentiment_background(user_id, time_range, extended=False):
    """
    Dedicated worker function to run the heavy AI sentiment analysis via QStash.
    """
    try:
        # 1. Get current cached state
        result = get_cached_top_data("top", user_id, time_range)
        if not result:
            print(f"LASTFM SENTIMENT ERROR: No cached data for {user_id}")
            return
            
        enhanced_tracks = result.get("tracks", [])
        num_to_analyze = 20 if extended else 10
        tracks_to_analyze = enhanced_tracks[:num_to_analyze]
        
        print(f"LASTFM SENTIMENT WORKER: Processing {len(tracks_to_analyze)} tracks for {user_id}...")
        
        def _update_progress(msg):
            if isinstance(msg, dict):
                cache_top_data("progress", user_id, time_range, msg, ttl=60)
                report_str = f"Syncing ({msg['current']}/{msg['total']}): {msg['trackName'][:30]}..."
            else:
                report_str = msg

            # RACE CONDITION PROTECTION
            if not extended:
                current = get_cached_top_data("top", user_id, time_range)
                if current and "/20)" in current.get("sentiment_report", ""):
                    print(f"LASTFM WORKER: Stopping standard sync because an extended sync is in progress for {user_id}")
                    raise Exception("Interrupted by extended sync")
            
            if extended:
                result['extended_sentiment_report'] = report_str
            else:
                result['sentiment_report'] = report_str
            cache_top_data("top", user_id, time_range, result, ttl=300)
            
        sentiment_report, sentiment_scores = generate_sentiment_analysis(
            tracks_to_analyze, 
            progress_callback=_update_progress, 
            extended=extended
        )
        
        if extended:
            result['extended_sentiment_report'] = sentiment_report
            result['extended_sentiment_scores'] = sentiment_scores
            result['extended_sentiment_count'] = 20
        else:
            result['sentiment_report'] = sentiment_report
            result['sentiment_scores'] = sentiment_scores
            result['sentiment_count'] = 10
        
        # Final Save
        cache_top_data("top", user_id, time_range, result)
        save_user_sync(user_id, time_range, result)
        print(f"LASTFM SENTIMENT WORKER SUCCESS: Completed for {user_id}")

    except Exception as e:
        print(f"LASTFM SENTIMENT WORKER ERROR: {e}")
        import traceback
        traceback.print_exc()

# --- SPOTIFY ENHANCEMENT HELPERS ---

def _get_spotify_app_token():
    """Get Client Credentials token from Spotify."""
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("SPOTIFY APP TOKEN ERROR: Missing credentials in .env")
        return None

    auth_str = f"{client_id}:{client_secret}"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()

    headers = {
        "Authorization": f"Basic {b64_auth_str}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}

    try:
        res = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data, timeout=5)
        if res.status_code == 200:
            token = res.json().get("access_token")
            if token:
                print(f"SPOTIFY APP TOKEN: Successfully retrieved (starts with {token[:6]}...)")
            return token
        else:
            print(f"SPOTIFY APP TOKEN ERROR: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"SPOTIFY APP TOKEN ERROR: {e}")
    return None

def _search_spotify_artist(artist_name, token):
    """Search for an artist on Spotify and return (id, image_url)."""
    if not token or not artist_name:
        return None, "", []
    headers = {"Authorization": f"Bearer {token}"}
    
    target_name = artist_name.lower().strip()
    sp_artist = None

    def find_best_match(items):
        # 1. Exact match
        for a in items:
            if a["name"].lower().strip() == target_name:
                return a
        # 2. Strict substring match
        for a in items:
            sp_name = a["name"].lower().strip()
            if target_name in sp_name or sp_name in target_name:
                return a
        # 3. Absolute fallback: trust Spotify's search rank
        return items[0] if items else None

    # Try exact match first
    params = {"q": f"artist:\"{artist_name}\"", "type": "artist", "limit": 5}
    try:
        res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
        if res.status_code == 200:
            sp_artist = find_best_match(res.json().get("artists", {}).get("items", []))
    except Exception:
        pass
        
    # Fallback to broad search
    if not sp_artist:
        params = {"q": artist_name, "type": "artist", "limit": 5}
        try:
            res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
            if res.status_code == 200:
                sp_artist = find_best_match(res.json().get("artists", {}).get("items", []))
        except Exception:
            pass

    if sp_artist:
        images = sp_artist.get("images", [])
        img_url = images[0]["url"] if images else ""
        print(f"SPOTIFY ARTIST SEARCH: Match found for '{artist_name}' -> '{sp_artist['name']}'")
        return sp_artist["id"], img_url, sp_artist.get("genres", [])
        
    print(f"SPOTIFY ARTIST SEARCH: No match found for '{artist_name}'")
    return None, "", []



def _search_spotify_track(track_name, artist_name, token):
    """Search for a track on Spotify and return (id, image_url)."""
    if not token or not track_name:
        return None, ""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Strip common suffixes for cleaner search (e.g., " - Remastered", "(Live)")
    clean_track = track_name.split(" - ")[0].split(" (")[0]
    
    # Try combined search first (Strict)
    query = f"track:\"{clean_track}\" artist:\"{artist_name}\""
    params = {"q": query, "type": "track", "limit": 2} # Get top 2 to check best match
    try:
        res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
        if res.status_code == 200:
            items = res.json().get("tracks", {}).get("items", [])
            for item in items:
                # Basic check: is the artist name similar?
                sp_artist_name = item.get("artists", [{}])[0].get("name", "").lower()
                sp_track_name = item.get("name", "").lower()
                target_artist = artist_name.lower()
                target_track = clean_track.lower()
                
                # Check both artist and track name similarity
                if (target_artist in sp_artist_name or sp_artist_name in target_artist) and \
                   (target_track in sp_track_name or sp_track_name in target_track):
                    images = item.get("album", {}).get("images", [])
                    img_url = images[0]["url"] if images else ""
                    return item["id"], img_url
    except Exception:
        pass
    
    # Fallback to broad search with clean terms
    query = f"{clean_track} {artist_name}"
    params = {"q": query, "type": "track", "limit": 2}
    try:
        res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
        if res.status_code == 200:
            items = res.json().get("tracks", {}).get("items", [])
            for item in items:
                sp_artist_name = item.get("artists", [{}])[0].get("name", "").lower()
                sp_track_name = item.get("name", "").lower()
                target_artist = artist_name.lower()
                target_track = clean_track.lower()
                
                if (target_artist in sp_artist_name or sp_artist_name in target_artist) and \
                   (target_track in sp_track_name or sp_track_name in target_track):
                    images = item.get("album", {}).get("images", [])
                    img_url = images[0]["url"] if images else ""
                    print(f"SPOTIFY TRACK SEARCH: Match found for '{track_name}' -> '{item['name']}' by '{sp_artist_name}'")
                    return item["id"], img_url
    except Exception:
        pass
    print(f"SPOTIFY TRACK SEARCH: No match found for '{track_name}' by '{artist_name}'")
    return None, ""

# --- EXTERNAL PUBLIC API ENHANCEMENT HELPERS ---
def _search_itunes_track(track_name, artist_name):
    """Fallback search using iTunes API for high-res album artwork."""
    try:
        # Clean track name (remove " - Remastered", "(Live)", etc.)
        clean_track = track_name.split(" - ")[0].split(" (")[0]
        query = f"{clean_track} {artist_name}"
        url = f"https://itunes.apple.com/search?term={quote_plus(query)}&entity=song&limit=1"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data['resultCount'] > 0:
                result = data['results'][0]
                sp_artist_name = result.get('artistName', '').lower()
                sp_track_name = result.get('trackName', '').lower()
                target_artist = artist_name.lower()
                target_track = clean_track.lower()
                
                # STRICT MATCH CHECK for iTunes
                if (target_artist in sp_artist_name or sp_artist_name in target_artist) and \
                   (target_track in sp_track_name or sp_track_name in target_track):
                    art = result.get('artworkUrl100', '')
                    if art:
                        return art.replace('100x100bb', '600x600bb')
    except Exception as e:
        print(f"ITUNES FALLBACK ERROR: {e}")
    return ""

def _search_deezer_artist(artist_name):
    """Fallback search using Deezer API with strict name verification."""
    if not artist_name:
        return ""
    try:
        url = f"https://api.deezer.com/search/artist?q={quote_plus(artist_name)}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            items = data.get("data", [])
            target = artist_name.lower().strip()
            
            for item in items:
                dz_name = item.get("name", "").lower().strip()
                # STRICT EXACT MATCH ONLY for Deezer fallback
                if dz_name == target:
                    best_img = item.get('picture_xl') or item.get('picture_big') or item.get('picture_medium')
                    if best_img:
                        return best_img
    except Exception as e:
        print(f"DEEZER FALLBACK ERROR: {e}")
    return ""

def _lastfm_request(method, params=None):
    """Make a Last.fm API request."""
    if params is None:
        params = {}
    params.update({
        "method": method,
        "api_key": LASTFM_API_KEY,
        "format": "json"
    })
    try:
        res = requests.get(LASTFM_API_URL, params=params, timeout=10)
        res.raise_for_status()
        return res.json()
    except requests.exceptions.RequestException as e:
        print(f"LASTFM API ERROR: {e}")
        return None


def _lastfm_signed_request(method, params=None):
    """Make a signed Last.fm API request (for auth endpoints)."""
    if params is None:
        params = {}
    params["method"] = method
    params["api_key"] = LASTFM_API_KEY

    # Build signature: sort params alphabetically, concat key+value, append secret, md5
    sig_string = ""
    for key in sorted(params.keys()):
        if key == "format":
            continue
        sig_string += key + str(params[key])
    sig_string += LASTFM_API_SECRET
    api_sig = hashlib.md5(sig_string.encode("utf-8")).hexdigest()

    params["api_sig"] = api_sig
    params["format"] = "json"

    try:
        res = requests.get(LASTFM_API_URL, params=params, timeout=10)
        res.raise_for_status()
        return res.json()
    except requests.exceptions.RequestException as e:
        print(f"LASTFM SIGNED API ERROR: {e}")
        return None


def get_session_key(token):
    """Exchange auth token for a session key."""
    return _lastfm_signed_request("auth.getSession", {"token": token})


def get_user_info(username):
    """Get Last.fm user profile info."""
    data = _lastfm_request("user.getInfo", {"user": username})
    if not data or "user" not in data:
        return None
    return data["user"]


def get_top_artists(username, time_range="medium_term", limit=20):
    """Get user's top artists from Last.fm."""
    period = PERIOD_MAP.get(time_range, "6month")
    data = _lastfm_request("user.getTopArtists", {
        "user": username,
        "period": period,
        "limit": limit
    })
    if not data or "topartists" not in data:
        return []
    return data["topartists"].get("artist", [])


def get_top_tracks(username, time_range="medium_term", limit=20):
    """Get user's top tracks from Last.fm."""
    period = PERIOD_MAP.get(time_range, "6month")
    data = _lastfm_request("user.getTopTracks", {
        "user": username,
        "period": period,
        "limit": limit
    })
    if not data or "toptracks" not in data:
        return []
    return data["toptracks"].get("track", [])


def get_top_tags(username, time_range="medium_term", limit=20):
    """Get user's top tags (genres) via their top artists."""
    # Last.fm doesn't have a direct user.getTopTags for genre analysis
    # So we fetch top artists and aggregate their tags
    artists = get_top_artists(username, time_range, limit)
    genre_count = {}
    for artist in artists:
        artist_name = artist.get("name", "")
        # Fetch artist tags
        tag_data = _lastfm_request("artist.getTopTags", {"artist": artist_name})
        if tag_data and "toptags" in tag_data:
            tags = tag_data["toptags"].get("tag", [])
            for tag in tags[:5]:  # Top 5 tags per artist
                tag_name = tag.get("name", "").lower()
                if tag_name:
                    genre_count[tag_name] = genre_count.get(tag_name, 0) + 1

    sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
    return [{"name": name, "count": count} for name, count in sorted_genres[:20]]


def _get_artist_image(artist_name):
    """Try to get artist image from Last.fm artist.getInfo."""
    data = _lastfm_request("artist.getInfo", {"artist": artist_name})
    if data and "artist" in data:
        images = data["artist"].get("image", [])
        for img in reversed(images):  # Largest first
            url = img.get("#text", "")
            if url and url.strip():
                return url
    return ""


def _get_track_image(artist_name, track_name):
    """Get track/album image from Last.fm track.getInfo."""
    data = _lastfm_request("track.getInfo", {
        "artist": artist_name,
        "track": track_name
    })
    if data and "track" in data:
        album = data["track"].get("album", {})
        images = album.get("image", [])
        for img in reversed(images):
            url = img.get("#text", "")
            if url and url.strip():
                return url
    return ""


def sync_lastfm_user_data(username: str, time_range: str = "medium_term", background_tasks: BackgroundTasks = None, extended: bool = False, force_sync: bool = False):
    """
    Fast-sync user from Last.fm and trigger background enrichment.
    """
    print(f"LASTFM SYNC: Starting sync for user '{username}', time_range='{time_range}'")

    # 1. Fetch User Info
    user_info = get_user_info(username)
    if not user_info:
        print(f"LASTFM SYNC ERROR: Could not fetch user info for '{username}'")
        return None

    display_name = user_info.get("realname") or user_info.get("name", username)
    user_image = ""
    user_images = user_info.get("image", [])
    for img in reversed(user_images):
        url = img.get("#text", "")
        if url and url.strip():
            user_image = url
            break

    user_id = f"lastfm:{username}"
    save_user(user_id, display_name)

    # 2. Fetch Top Data (Artists/Tracks)
    raw_artists = get_top_artists(username, time_range, 20)
    raw_tracks = get_top_tracks(username, time_range, 20)

    # 3. Fast Map to Personalify format (No Spotify search here, just raw LFM)
    artists_to_save = []
    artist_ids = []
    result_artists = []
    for artist in raw_artists:
        artist_name = artist.get("name", "Unknown")
        artist_id = f"lfm_{artist.get('mbid', '') or artist_name.replace(' ', '_').lower()}"
        playcount = int(artist.get("playcount", 0))
        
        # Fast Image fetch from LFM
        artist_image = ""
        images = artist.get("image", [])
        for img in reversed(images):
            url = img.get("#text", "")
            if url and url.strip() and "2a96cbd8b46e442fc41c2b86b821562f" not in url and "4128a6eb29f94943c9d206c08e625904" not in url:
                artist_image = url
                break
        
        if not artist_image:
             artist_image = ""

        artist_ids.append(artist_id)
        artists_to_save.append((artist_id, artist_name, playcount, artist_image))
        result_artists.append({
            "id": artist_id, "name": artist_name, "genres": [], 
            "popularity": playcount, "image": artist_image, "external_url": artist.get("url")
        })

    tracks_to_save = []
    track_ids = []
    result_tracks = []
    for track in raw_tracks:
        track_name = track.get("name", "Unknown")
        artist_info = track.get("artist", {})
        artist_name = artist_info.get("name") if isinstance(artist_info, dict) else str(artist_info) or "Unknown Artist"
        playcount = int(track.get("playcount", 0))
        
        track_id = f"lfm_{(track_name + '_' + artist_name).replace(' ', '_').lower()}"
        track_image = ""
        images = track.get("image", [])
        for img in reversed(images):
            url = img.get("#text", "")
            if url and url.strip() and "2a96cbd8b46e442fc41c2b86b821562f" not in url and "4128a6eb29f94943c9d206c08e625904" not in url:
                track_image = url
                break
        
        if not track_image:
            track_image = ""

        track_ids.append(track_id)
        tracks_to_save.append((track_id, track_name, playcount, None, track_image))
        result_tracks.append({
            "id": track_id, "name": track_name, "artists": [artist_name],
            "album": {"name": "Last.fm", "type": "track", "total_tracks": 1},
            "popularity": playcount, "preview_url": None, "image": track_image,
            "duration_ms": int(track.get("duration", 0)) * 1000, "external_url": track.get("url")
        })

    # Save to database
    save_artists_batch(artists_to_save)
    save_tracks_batch(tracks_to_save)
    save_user_associations_batch("user_artists", "artist_id", user_id, artist_ids)
    save_user_associations_batch("user_tracks", "track_id", user_id, track_ids)

    # 4. Build Initial Result (Syncing state)
    result = {
        "user": display_name,
        "image": user_image,
        "artists": result_artists,
        "tracks": result_tracks,
        "genres": [],
        "time_range": time_range,
        "source": "lastfm",
        "sentiment_report": "Syncing your music vibe",
        "sentiment_scores": [],
        "_raw_artists": raw_artists,
        "_raw_tracks": raw_tracks
    }

    # 5. Handle Background Tasks (QStash for Vercel, BackgroundTasks for Local)
    # Save temporary results first
    cache_top_data("top", f"lastfm:{username}", time_range, result, ttl=300)
    
    from app.qstash_handler import publish_to_qstash
    did_push = publish_to_qstash("/api/tasks/lastfm-enhancement", {
        "username": username,
        "time_range": time_range,
        "extended": extended,
        "result": result,
        "force_sync": force_sync
    })

    if not did_push and background_tasks:
        background_tasks.add_task(process_lastfm_enhancement_background, username, time_range, result, extended, force_sync)
        print(f"LASTFM SYNC: Fast sync success for {username}. Local background task triggered (Force: {force_sync}).")
    elif did_push:
        print(f"LASTFM SYNC: Fast sync success for {username}. QStash enhancement triggered (Force: {force_sync}).")
    else:
        # Fallback to sync if no other choice
        process_lastfm_enhancement_background(username, time_range, result, extended, force_sync)
        
    return result
