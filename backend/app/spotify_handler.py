
import requests
from fastapi import HTTPException
from app.db_handler import (
    save_user,
    save_artists_batch,
    save_tracks_batch,
    save_user_associations_batch
)
from app.cache_handler import cache_top_data
from app.mongo_handler import save_user_sync
from app.nlp_handler import generate_emotion_paragraph

def sync_user_data(access_token: str, time_range: str = "medium_term"):
    """
    Fetches latest top tracks/artists from Spotify using access_token.
    Updates Postgres (Artists/Tracks), MongoDB (History), and Redis (Cache).
    Returns the formatted result dictionary.
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
    # Note: Mobile used limit=20 in the sync endpoint. We'll stick to 20 for better data.
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

    # 6. Analyze Emotions (Hybrid Model)
    # This might take time (5-8 seconds), but we have increased mobile timeout.
    track_names = [track['name'] for track in result.get("tracks", [])]
    emotion_paragraph, top_emotions = generate_emotion_paragraph(track_names)
    
    result['emotion_paragraph'] = emotion_paragraph
    result['top_emotions'] = top_emotions

    # 7. Cache & Archive
    cache_top_data("top_v2", spotify_id, time_range, result)
    save_user_sync(spotify_id, time_range, result)

    return result
