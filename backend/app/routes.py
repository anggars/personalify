import os
import requests
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse

from app.db_handler import (
    save_user, save_artist, save_track,
    save_user_artist, save_user_track
)
from app.cache_handler import cache_top_data, get_cached_top_data
from app.mongo_handler import save_user_sync, get_user_history

router = APIRouter()


@router.get("/", tags=["Root"])
def root():
    return {"message": "Personalify root"}


@router.get("/login", tags=["Auth"])
def login():
    """
    Redirect ke halaman Spotify Login untuk otorisasi user
    """
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")
    scope = "user-top-read"

    if not client_id or not redirect_uri:
        return {"error": "Spotify client_id or redirect_uri not configured."}

    query_params = urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope
    })

    return RedirectResponse(url=f"https://accounts.spotify.com/authorize?{query_params}")


@router.get("/callback", tags=["Auth"])
def callback(code: str = Query(..., description="Spotify Authorization Code")):
    """
    Menukar kode otorisasi dengan access_token dan refresh_token
    """
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
    return JSONResponse(content=response.json())


@router.get("/sync/top-data", tags=["Sync"])
def sync_top_data(
    access_token: str = Query(..., description="Spotify Access Token"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"], description="Time range: short, medium, long")
):
    """
    Sinkronisasi data top artists dan top tracks dari Spotify (token langsung dari query)
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    user_profile = requests.get("https://api.spotify.com/v1/me", headers=headers).json()
    if "error" in user_profile:
        return {"error": user_profile["error"]["message"]}

    spotify_id = user_profile["id"]
    display_name = user_profile.get("display_name", "Unknown")
    save_user(spotify_id, display_name)

    # Artists
    artists = requests.get(
        f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=10",
        headers=headers
    ).json().get("items", [])

    # Tracks
    tracks = requests.get(
        f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=10",
        headers=headers
    ).json().get("items", [])

    result = {"user": display_name, "artists": [], "tracks": []}

    for artist in artists:
        save_artist(artist["id"], artist["name"], artist["popularity"], artist["images"][0]["url"] if artist["images"] else None)
        save_user_artist(spotify_id, artist["id"])
        result["artists"].append({
            "id": artist["id"],
            "name": artist["name"],
            "genres": artist.get("genres", []),
            "popularity": artist["popularity"],
            "image": artist["images"][0]["url"] if artist["images"] else ""
        })

    for track in tracks:
        save_track(track["id"], track["name"], track["popularity"], track.get("preview_url"))
        save_user_track(spotify_id, track["id"])
        result["tracks"].append({
            "id": track["id"],
            "name": track["name"],
            "artists": [a["name"] for a in track["artists"]],
            "album": track["album"]["name"],
            "popularity": track["popularity"],
            "preview_url": track.get("preview_url")
        })

    cache_top_data("top", spotify_id, time_range, result)
    save_user_sync(spotify_id, time_range, result)
    return result


@router.get("/top-data", tags=["Query"])
def get_top_data(
    spotify_id: str = Query(...),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"]),
    limit: int = Query(10, ge=1),
    sort: str = Query("popularity")
):
    """
    Ambil data top tracks dan artists dari Redis berdasarkan ID dan rentang waktu
    """
    data = get_cached_top_data("top", spotify_id, time_range)
    if not data:
        return {"message": "No cached data found."}

    def sort_items(items):
        return sorted(items, key=lambda x: x.get(sort, 0), reverse=True)[:limit]

    data["artists"] = sort_items(data.get("artists", []))
    data["tracks"] = sort_items(data.get("tracks", []))
    return data


@router.get("/top-genres", tags=["Query"])
def top_genres(
    spotify_id: str = Query(...),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"])
):
    """
    Ambil genre paling dominan dari daftar top artists
    """
    data = get_cached_top_data("top", spotify_id, time_range)
    if not data:
        return {"error": "No cached data found for this user/time_range"}

    genre_count = {}
    for artist in data.get("artists", []):
        for genre in artist.get("genres", []):
            genre_count[genre] = genre_count.get(genre, 0) + 1

    sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
    return {"genres": [{"name": name, "count": count} for name, count in sorted_genres]}


@router.get("/history", tags=["Query"])
def get_sync_history(spotify_id: str = Query(...)):
    """
    Ambil riwayat sync user dari MongoDB berdasarkan spotify_id
    """
    return get_user_history(spotify_id)
