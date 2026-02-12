
import requests

from fastapi import HTTPException, BackgroundTasks
from app.db_handler import (
    save_user,
    save_artists_batch,
    save_tracks_batch,
    save_user_associations_batch
)
from app.cache_handler import cache_top_data
from app.mongo_handler import save_user_sync
from app.nlp_handler import generate_sentiment_analysis

def process_sentiment_background(spotify_id, time_range, result, extended=False):
    """
    Helper function to run emotion analysis and caching in background/foreground.
    """
    try:
        # 6. Analyze Emotions (Hybrid Model)
        # STANDARD: Use Top 10 tracks for analysis (vibe/MBTI) for concentrated results by default.
        # EXTENDED: Use Top 20 tracks if requested (e.g. for Web Easter Eggs).
        tracks = result.get("tracks", [])
        num_to_analyze = 20 if extended else 10
        tracks_to_analyze = tracks[:num_to_analyze]
        
        # Include artist name for better AI context
        track_names = [f"{t['name']} by {', '.join(t.get('artists', []))}" if t.get('artists') else t['name'] for t in tracks_to_analyze]
        
        # Pass extended flag to paragraph generator
        sentiment_report, sentiment_scores = generate_sentiment_analysis(track_names, extended=extended)
        
        result['sentiment_report'] = sentiment_report
        result['sentiment_scores'] = sentiment_scores

        # 7. Cache & Archive
        cache_top_data("top_v2", spotify_id, time_range, result)
        save_user_sync(spotify_id, time_range, result)
        print(f"BACKGROUND PROCESSING SUCCESS: {'EXTENDED' if extended else 'STANDARD'} Sentiment analysis completed for {spotify_id}")
    except Exception as e:
        print(f"BACKGROUND PROCESSING ERROR: {e}")

def sync_user_data(access_token: str, time_range: str = "medium_term", background_tasks: BackgroundTasks = None, extended: bool = False):
    """
    Fetches latest top tracks/artists from Spotify using access_token.
    Updates Postgres (Artists/Tracks), MongoDB (History), and Redis (Cache).
    Returns the formatted result dictionary (immediately if background_tasks is used).
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # 1. Fetch User Profile
    res = requests.get("https://api.spotify.com/v1/me", headers=headers)
    
    if res.status_code == 401:
        print(f"SYNC ERROR: TOKEN EXPIRED FOR ACCESS_TOKEN={access_token[:10]}...")
        raise HTTPException(status_code=401, detail="Spotify token expired. Please login again.")

    if res.status_code != 200:
        print(f"SYNC ERROR: FAILED TO FETCH USER PROFILE. STATUS: {res.status_code}")
        # Try to parse error message
        try:
            detail = res.json()
        except:
            detail = res.text
        raise HTTPException(status_code=res.status_code, detail=detail)

    user_profile = res.json()
    spotify_id = user_profile["id"]
    display_name = user_profile.get("display_name", "Unknown")
    
    # Save User to DB
    save_user(spotify_id, display_name)

    # 2. Fetch Top Data
    # Note: Fetching 20 to allow flexibility (Web Top 20). 
    # Analysis will conditionalize between Top 10 or Top 20.
    artist_url = f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=20"
    track_url = f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=20"

    artist_resp = requests.get(artist_url, headers=headers)
    track_resp = requests.get(track_url, headers=headers)

    if artist_resp.status_code != 200 or track_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to sync data. Token might be expired.")

    artists = artist_resp.json().get("items", [])
    tracks = track_resp.json().get("items", [])

    # 3. Process & Save to Postgres
    artists_to_save = []
    artist_ids = []
    for artist in artists:
        artist_ids.append(artist["id"])
        artists_to_save.append((
            artist["id"],
            artist["name"],
            artist["popularity"],
            artist["images"][0]["url"] if artist.get("images") else None
        ))

    tracks_to_save = []
    track_ids = []
    for track in tracks:
        track_ids.append(track["id"])
        tracks_to_save.append((
            track["id"],
            track["name"],
            track["popularity"],
            track.get("preview_url")
        ))

    save_artists_batch(artists_to_save)
    save_tracks_batch(tracks_to_save)
    save_user_associations_batch("user_artists", "artist_id", spotify_id, artist_ids)
    save_user_associations_batch("user_tracks", "track_id", spotify_id, track_ids)
    
    # 4. Extract Genres & Compute Top List
    genre_count = {}
    for artist in artists:
        for genre in artist.get("genres", []):
            genre_count[genre] = genre_count.get(genre, 0) + 1
    
    # Sort genres by count
    sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
    # We store top 20 genres in the result list (previously logic was 20)
    genres_list = [{"name": genre, "count": count} for genre, count in sorted_genres[:20]]
    
    # 5. Build Result Object
    # Mobile app expects specifically formatted result
    result = {
        "user": display_name, 
        "image": user_profile["images"][0]["url"] if user_profile.get("images") else None,
        "artists": [], 
        "tracks": [],
        "genres": genres_list,
        "time_range": time_range
    }

    # Populate result artists
    for artist in artists:
         result["artists"].append({
            "id": artist["id"], 
            "name": artist["name"], 
            "genres": artist.get("genres", []),
            "popularity": artist["popularity"], 
            "image": artist["images"][0]["url"] if artist.get("images") else ""
        })

    # Populate result tracks
    for track in tracks:
        album_image_url = track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else ""
        result["tracks"].append({
            "id": track["id"], 
            "name": track["name"], 
            "artists": [a["name"] for a in track.get("artists", [])],
            "album": {
                "name": track["album"]["name"],
                "type": track["album"]["album_type"],
                "total_tracks": track["album"]["total_tracks"]
            },
            "popularity": track["popularity"],
            "preview_url": track.get("preview_url"), 
            "image": album_image_url,
            "duration_ms": track["duration_ms"]
        })

    # 6. Hybrid Processing Logic
    if background_tasks:
        # 6.1 Check for existing sentiment to avoid "getting ready" if we already had a vibe
        from app.cache_handler import get_cached_top_data
        existing_cached = get_cached_top_data("top_v2", spotify_id, time_range)
        
        if existing_cached and existing_cached.get('sentiment_report'):
            result['sentiment_report'] = existing_cached.get('sentiment_report')
            result['sentiment_scores'] = existing_cached.get('sentiment_scores', [])
            print(f"SYNC: Preserving existing sentiment for {spotify_id}")
        else:
            result['sentiment_report'] = "Sentiment analysis is getting ready..."
            result['sentiment_scores'] = []
        
        # 6.2 Cache partial result with short TTL
        cache_top_data("top_v2", spotify_id, time_range, result, ttl=300) 
        
        # 6.3 Trigger real analysis in background
        background_tasks.add_task(process_sentiment_background, spotify_id, time_range, result, extended)
    else:
        # Legacy/Mobile synchronous mode
        process_sentiment_background(spotify_id, time_range, result, extended)

    return result
