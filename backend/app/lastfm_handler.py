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
from app.cache_handler import cache_top_data
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

# --- BACKGROUND PROCESSING ---

def process_lastfm_enhancement_background(username, time_range, result, extended=False):
    """
    Background task to enhance Last.fm data with Spotify metadata,
    artist tags (genres), and sentiment analysis.
    """
    try:
        user_id = f"lastfm:{username}"
        print(f"LASTFM BG: Starting enhancement for '{username}'...")
        
        # 1. Spotify Metadata Enhancement
        sp_token = _get_spotify_app_token()
        artist_results_map = {}
        track_results_map = {}
        
        raw_artists = result.get("_raw_artists", [])
        raw_tracks = result.get("_raw_tracks", [])

        if sp_token:
            print(f"LASTFM BG: Mapping to Spotify...")
            with ThreadPoolExecutor(max_workers=10) as executor:
                artist_futures = {
                    executor.submit(_search_spotify_artist, a.get("name"), sp_token): i 
                    for i, a in enumerate(raw_artists)
                }
                track_futures = {
                    executor.submit(_search_spotify_track, t.get("name"), 
                                    t.get("artist", {}).get("name") if isinstance(t.get("artist"), dict) else t.get("artist"), 
                                    sp_token): i 
                    for i, t in enumerate(raw_tracks)
                }
                
                for future in artist_futures:
                    idx = artist_futures[future]
                    try:
                        sp_id, sp_img, sp_genres = future.result()
                        artist_results_map[idx] = {"id": sp_id, "image": sp_img, "genres": sp_genres}
                    except Exception as e:
                        print(f"BG Spotify artist search error: {e}")
                
                for future in track_futures:
                    idx = track_futures[future]
                    try:
                        sp_id, sp_img = future.result()
                        track_results_map[idx] = {"id": sp_id, "image": sp_img}
                    except Exception as e:
                        print(f"BG Spotify track search error: {e}")

        # 2. Update Artists & Tracks with enhanced metadata incrementally
        enhanced_artists = result.get("artists", [])
        enhanced_tracks = result.get("tracks", [])
        
        print(f"LASTFM BG: Enhancing artists...")
        for i, ra in enumerate(enhanced_artists):
            sp_data = artist_results_map.get(i, {})
            if sp_data.get("id"):
                ra["id"] = sp_data["id"]
            if sp_data.get("image"):
                ra["image"] = sp_data["image"]
            elif not ra.get("image") or "blank-profile-picture" in ra.get("image", "") or "2a96cbd8b46e442fc41c2b86b821562f" in ra.get("image", ""):
                # Try Deezer as fallback
                deezer_img = _search_deezer_artist(ra.get("name", ""))
                if deezer_img:
                    ra["image"] = deezer_img
                else:
                    ra["image"] = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
            
        # Update cache after artists
        cache_top_data("top_v2", user_id, time_range, result, ttl=300)
            
        print(f"LASTFM BG: Enhancing tracks...")
        for i, rt in enumerate(enhanced_tracks):
            sp_data = track_results_map.get(i, {})
            if sp_data.get("id"):
                rt["id"] = sp_data["id"]
            if sp_data.get("image"):
                rt["image"] = sp_data["image"]
            elif not rt.get("image") or "photo-1493225255756-d9584f8606e9" in rt.get("image", "") or "photo-1614613535308-eb5fbd3d2c17" in rt.get("image", "") or "4128a6eb29f94943c9d206c08e625904" in rt.get("image", ""):
                 # Try iTunes as fallback
                 artist_name = rt.get("artists", [""])[0]
                 itunes_img = _search_itunes_track(rt.get("name", ""), artist_name)
                 if itunes_img:
                     rt["image"] = itunes_img
                 else:
                     rt["image"] = "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=300&h=300&auto=format&fit=crop"

        # Update cache after tracks
        cache_top_data("top_v2", user_id, time_range, result, ttl=300)

        # 3. Fetch Artist Tags (Genres) - Optimized with threading
        genre_count = {}
        def _fetch_artist_genres(artist_name):
            try:
                tag_data = _lastfm_request("artist.getTopTags", {"artist": artist_name})
                if tag_data and "toptags" in tag_data:
                    tags = tag_data["toptags"].get("tag", [])
                    return [t.get("name", "").lower() for t in tags[:5]]
            except:
                pass
            return []

        print(f"LASTFM BG: Fetching artist tags...")
        with ThreadPoolExecutor(max_workers=5) as executor:
            artist_names = [a.get("name") for a in raw_artists[:15]] # Use more artists for better genre coverage
            future_genres = {executor.submit(_fetch_artist_genres, name): name for name in artist_names}
            
            for future in future_genres:
                artist_name = future_genres[future]
                try:
                    genres = future.result()
                    # Fallback to Spotify genres if LFM tags are thin
                    if not genres or len(genres) < 2:
                        # Find the index of this artist in results
                        artist_idx = next((i for i, n in enumerate(artist_names) if n == artist_name), None)
                        if artist_idx is not None:
                            sp_genres = artist_results_map.get(artist_idx, {}).get("genres", [])
                            if sp_genres:
                                genres = list(set(genres + sp_genres))[:5]

                    for g in genres:
                        # Filter out useless tags
                        if g not in ["seen live", "favorites", "favourite", "awesome", "scrobble", "alternative", "all", "amazing"]:
                            genre_count[g] = genre_count.get(g, 0) + 1
                    # Update result Entry
                    for ra in enhanced_artists:
                        if ra["name"] == artist_name:
                            ra["genres"] = genres
                            break
                except:
                    continue

        sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
        genres_list = [{"name": name, "count": count} for name, count in sorted_genres[:20]]
        
        result["genres"] = genres_list
        # Update cache after genres
        cache_top_data("top_v2", user_id, time_range, result, ttl=300)

        # 4. Sentiment Analysis
        num_to_analyze = 20 if extended else 10
        tracks_to_analyze = enhanced_tracks[:num_to_analyze]
        track_names = [
            f"{t['name']} by {', '.join(t.get('artists', []))}" if t.get('artists') 
            else t['name'] 
            for t in tracks_to_analyze
        ]
        
        print(f"LASTFM BG: Generating sentiment analysis...")
        sentiment_report, sentiment_scores = generate_sentiment_analysis(track_names, extended=extended)
        result['sentiment_report'] = sentiment_report
        result['sentiment_scores'] = sentiment_scores
        
        # Cleanup raw data to save space
        if "_raw_artists" in result: del result["_raw_artists"]
        if "_raw_tracks" in result: del result["_raw_tracks"]

        # 5. Final Cache & Archive
        cache_top_data("top_v2", user_id, time_range, result)
        save_user_sync(user_id, time_range, result)
        print(f"LASTFM BG SUCCESS: Enhancement completed for '{username}'")
        
    except Exception as e:
        print(f"LASTFM BG ERROR: {e}")

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
        return None, ""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try exact match first
    params = {"q": f"artist:\"{artist_name}\"", "type": "artist", "limit": 1}
    try:
        res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
        if res.status_code == 200:
            items = res.json().get("artists", {}).get("items", [])
            if items:
                sp_artist = items[0]
                # STRICT MATCH CHECK: Only accept if names are reasonably similar
                sp_name = sp_artist["name"].lower()
                target_name = artist_name.lower()
                if target_name in sp_name or sp_name in target_name:
                    images = sp_artist.get("images", [])
                    img_url = images[0]["url"] if images else ""
                    print(f"SPOTIFY ARTIST SEARCH: Match found for '{artist_name}' -> '{sp_artist['name']}'")
                    return sp_artist["id"], img_url, sp_artist.get("genres", [])
    except Exception:
        pass
        
    # Fallback to broad search
    params = {"q": artist_name, "type": "artist", "limit": 1}
    try:
        res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
        if res.status_code == 200:
            items = res.json().get("artists", {}).get("items", [])
            if items:
                sp_artist = items[0]
                # STRICT MATCH CHECK for fallback
                sp_name = sp_artist["name"].lower()
                target_name = artist_name.lower()
                if target_name in sp_name or sp_name in target_name:
                    images = sp_artist.get("images", [])
                    img_url = images[0]["url"] if images else ""
                    print(f"SPOTIFY ARTIST SEARCH (Fallback): Match found for '{artist_name}' -> '{sp_artist['name']}'")
                    return sp_artist["id"], img_url, sp_artist.get("genres", [])
    except Exception:
        pass
        
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
    """Fallback search using Deezer API for artist pictures."""
    try:
        url = f"https://api.deezer.com/search/artist?q={quote_plus(artist_name)}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if 'data' in data and len(data['data']) > 0:
                return data['data'][0].get('picture_xl', '')
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


def sync_lastfm_user_data(username: str, time_range: str = "medium_term", background_tasks: BackgroundTasks = None, extended: bool = False):
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
             artist_image = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"

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
            track_image = "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=300&h=300&auto=format&fit=crop"

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
        "sentiment_report": "Syncing your music vibe... (Metadata enhancement in progress)",
        "sentiment_scores": [],
        "_raw_artists": raw_artists,
        "_raw_tracks": raw_tracks
    }

    # 5. Handle Background Tasks
    if background_tasks:
        # Save temporary results
        cache_top_data("top_v2", user_id, time_range, result, ttl=300)
        background_tasks.add_task(process_lastfm_enhancement_background, username, time_range, result, extended)
        print(f"LASTFM SYNC: Fast sync success for {username}. Background task triggered.")
    else:
        # Synchronous fallback (if needed)
        process_lastfm_enhancement_background(username, time_range, result, extended)
        
    return result
