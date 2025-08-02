import os
import requests
import traceback
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from typing import Optional

from app.db_handler import (
    save_user, save_artist, save_track,
    save_user_artist, save_user_track
)
from app.cache_handler import cache_top_data, get_cached_top_data
from app.mongo_handler import save_user_sync, get_user_history

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/", response_class=HTMLResponse, tags=["Root"])
def root(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})


@router.get("/login", tags=["Auth"])
def login():
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")
    scope = "user-top-read"

    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Spotify client_id or redirect_uri not configured.")

    query_params = urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope
    })

    return RedirectResponse(url=f"https://accounts.spotify.com/authorize?{query_params}")


@router.get("/callback", tags=["Auth"])
def callback(code: str = Query(..., description="Spotify Authorization Code")):
    # --- BLOK DEBUGGING DIMULAI DI SINI ---
    print("\n--- [CALLBACK START] ---")
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI")

    # Step 1: Tukar code ke token
    print("[1] Menukar authorization code dengan access token...")
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    try:
        res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
        res.raise_for_status() # Error jika status bukan 2xx
        tokens = res.json()
        access_token = tokens.get("access_token")
        if not access_token:
            print("  [ERROR] Access token tidak ditemukan di respons.")
            raise HTTPException(status_code=400, detail="Access token not found in response.")
        print("  [SUCCESS] Token berhasil didapatkan.")
    except requests.exceptions.RequestException as e:
        print(f"  [ERROR] Gagal menukar token. Status: {e.response.status_code if e.response else 'N/A'}, Body: {e.response.text if e.response else 'N/A'}")
        raise HTTPException(status_code=500, detail=f"Failed to exchange token: {e.response.text if e.response else 'Unknown Error'}")

    # Step 2: Ambil profil user
    print("[2] Mengambil profil user...")
    headers_auth = {"Authorization": f"Bearer {access_token}"}
    user_res = requests.get("https://api.spotify.com/v1/me", headers=headers_auth)
    if user_res.status_code != 200:
        print(f"  [ERROR] Gagal mengambil profil user. Status: {user_res.status_code}, Body: {user_res.text}")
        raise HTTPException(status_code=user_res.status_code, detail=user_res.text)
    user_profile = user_res.json()
    spotify_id = user_profile["id"]
    display_name = user_profile.get("display_name", "Unknown")
    print(f"  [SUCCESS] Profil user didapatkan: {display_name}")
    
    print("[3] Menyimpan data user ke database (Postgres)...")
    save_user(spotify_id, display_name)
    print("  [SUCCESS] Data user berhasil disimpan.")

    # Step 3: Sync untuk semua time_range
    print("[4] Memulai sync data top artists/tracks...")
    time_ranges = ["short_term", "medium_term", "long_term"]
    for time_range in time_ranges:
        try:
            print(f"  [SYNC] Memproses time_range: {time_range}")
            artist_resp = requests.get(f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=10", headers=headers_auth)
            artist_resp.raise_for_status()
            artists = artist_resp.json().get("items", [])
            track_resp = requests.get(f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=10", headers=headers_auth)
            track_resp.raise_for_status()
            tracks = track_resp.json().get("items", [])
            print(f"    [API OK] Data artists ({len(artists)}) & tracks ({len(tracks)}) untuk '{time_range}' berhasil diambil.")

            result = {"user": display_name, "artists": [], "tracks": []}

            print("    [PROSES] Memproses dan menyimpan data artists...")
            for artist in artists:
                image_url = artist["images"][0]["url"] if artist.get("images") and len(artist["images"]) > 0 else None
                save_artist(artist["id"], artist["name"], artist["popularity"], image_url)
                save_user_artist(spotify_id, artist["id"])
                result["artists"].append({"id": artist["id"], "name": artist["name"], "genres": artist.get("genres", []), "popularity": artist["popularity"], "image": image_url if image_url else ""})

            print("    [PROSES] Memproses dan menyimpan data tracks...")
            for track in tracks:
                album_image_url = track["album"]["images"][0]["url"] if track.get("album", {}).get("images") and len(track["album"]["images"]) > 0 else ""
                save_track(track["id"], track["name"], track["popularity"], track.get("preview_url"))
                save_user_track(spotify_id, track["id"])
                result["tracks"].append({"id": track["id"], "name": track["name"], "artists": [a["name"] for a in track.get("artists", [])], "album": track["album"]["name"], "popularity": track["popularity"], "preview_url": track.get("preview_url"), "image": album_image_url})

            print("    [SIMPAN] Menyimpan ke cache (Redis) dan history (MongoDB)...")
            cache_top_data("top", spotify_id, time_range, result)
            save_user_sync(spotify_id, time_range, result)
            print(f"    [OK] Data untuk '{time_range}' berhasil diproses dan disimpan.")
        except Exception as e:
            print(f"  [FATAL ERROR] Terjadi error saat memproses time_range: {time_range}")
            traceback.print_exc() # Mencetak traceback error yang detail
            raise HTTPException(status_code=500, detail=f"An error occurred during data sync for {time_range}. Check logs.")

    print("[5] Semua proses sync selesai. Redirecting ke dashboard...")
    print("--- [CALLBACK END] ---\n")
    return RedirectResponse(url=f"/dashboard/{spotify_id}?time_range=short_term")

@router.get("/sync/top-data", tags=["Sync"])
def sync_top_data(
    access_token: str = Query(..., description="Spotify Access Token"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"], description="Time range")
):
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.get("https://api.spotify.com/v1/me", headers=headers)

    try:
        user_profile = res.json()
    except Exception:
        raise HTTPException(status_code=500, detail=f"Spotify API returned invalid response: {res.text}")

    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=user_profile.get("error", {}).get("message", "Unknown error"))

    spotify_id = user_profile["id"]
    display_name = user_profile.get("display_name", "Unknown")
    save_user(spotify_id, display_name)

    # Get top artists
    artist_resp = requests.get(
        f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=10",
        headers=headers
    )
    try:
        artist_data = artist_resp.json()
        artists = artist_data.get("items", [])
    except Exception:
        raise HTTPException(status_code=500, detail=f"Spotify artist API returned invalid response: {artist_resp.text}")

    # Get top tracks
    track_resp = requests.get(
        f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=10",
        headers=headers
    )
    try:
        track_data = track_resp.json()
        tracks = track_data.get("items", [])
    except Exception:
        raise HTTPException(status_code=500, detail=f"Spotify track API returned invalid response: {track_resp.text}")

    result = {"user": display_name, "artists": [], "tracks": []}

    for artist in artists:
        save_artist(
            artist["id"],
            artist["name"],
            artist["popularity"],
            artist["images"][0]["url"] if artist.get("images") else None
        )
        save_user_artist(spotify_id, artist["id"])
        result["artists"].append({
            "id": artist["id"],
            "name": artist["name"],
            "genres": artist.get("genres", []),
            "popularity": artist["popularity"],
            "image": artist["images"][0]["url"] if artist.get("images") else ""
        })

    for track in tracks:
        save_track(
            track["id"],
            track["name"],
            track["popularity"],
            track.get("preview_url")
        )
        save_user_track(spotify_id, track["id"])
        result["tracks"].append({
            "id": track["id"],
            "name": track["name"],
            "artists": [a["name"] for a in track.get("artists", [])],
            "album": track["album"]["name"],
            "popularity": track["popularity"],
            "preview_url": track.get("preview_url")
        })

    cache_top_data("top", spotify_id, time_range, result)
    save_user_sync(spotify_id, time_range, result)
    return result


@router.get("/top-data", tags=["Query"])
def get_top_data(
    spotify_id: str = Query(..., description="Spotify ID"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"]),
    limit: int = Query(10, ge=1),
    sort: str = Query("popularity")
):
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
    spotify_id: str = Query(..., description="Spotify ID"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"])
):
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
def get_sync_history(spotify_id: str = Query(..., description="Spotify ID")):
    return get_user_history(spotify_id)


@router.get("/dashboard/{spotify_id}", response_class=HTMLResponse, tags=["Dashboard"])
def dashboard(spotify_id: str, time_range: str = "medium_term", request: Request = None):
    data = get_cached_top_data("top", spotify_id, time_range)
    if not data:
        return HTMLResponse(content="No data found", status_code=404)

    genre_count = {}
    for artist in data.get("artists", []):
        for genre in artist.get("genres", []):
            genre_count[genre] = genre_count.get(genre, 0) + 1
    sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
    genre_list = [{"name": name, "count": count} for name, count in sorted_genres]

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": data["user"],
        "artists": data["artists"],
        "tracks": data["tracks"],
        "genres": genre_list,
        "time_range": time_range
    })
