import os
import requests
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Query, HTTPException, Body
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from typing import Optional
from app.nlp_handler import generate_emotion_paragraph, analyze_lyrics_emotion

from app.db_handler import (
    save_user,
    save_artists_batch,
    save_tracks_batch,
    save_user_associations_batch
)
from app.cache_handler import cache_top_data, get_cached_top_data
from app.mongo_handler import save_user_sync, get_user_history
from app.genius_lyrics import (
    search_artist, artist_songs, song_lyrics
)

router = APIRouter()
# --- Perbaikan Path Template ---
current_dir = os.path.dirname(os.path.abspath(__file__))
templates_dir = os.path.join(current_dir, "templates")
templates = Jinja2Templates(directory=templates_dir)
# --- Akhir Perbaikan ---

def get_redirect_uri(request: Request):
    """
    Fungsi helper untuk mendapatkan redirect URI yang tepat
    berdasarkan host yang mengakses
    """
    host = str(request.headers.get("x-forwarded-host", request.headers.get("host", "")))
    if "vercel.app" in host:
        return os.getenv("SPOTIFY_REDIRECT_URI_VERCEL", "https://personalify.vercel.app/callback")
    else:
        return os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8000/callback")

@router.get("/", response_class=HTMLResponse, tags=["Root"])
def root(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@router.get("/login", tags=["Auth"])
def login(request: Request):
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    redirect_uri = get_redirect_uri(request)
    scope = "user-top-read"
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Spotify client_id or redirect_uri not configured.")
    query_params = urlencode({
        "response_type": "code", "client_id": client_id,
        "redirect_uri": redirect_uri, "scope": scope
    })
    return RedirectResponse(url=f"https://accounts.spotify.com/authorize?{query_params}")

@router.get("/callback", tags=["Auth"])
def callback(request: Request, code: str = Query(..., description="Spotify Authorization Code")):
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = get_redirect_uri(request)

    # Step 1: Tukar code ke token
    payload = {
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
        "client_id": client_id, "client_secret": client_secret
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    tokens = res.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Access token not found in response.")

    # Step 2: Ambil profil user
    headers = {"Authorization": f"Bearer {access_token}"}
    user_res = requests.get("https://api.spotify.com/v1/me", headers=headers)
    if user_res.status_code != 200:
        raise HTTPException(status_code=user_res.status_code, detail=user_res.text)
    user_profile = user_res.json()
    spotify_id = user_profile["id"]
    display_name = user_profile.get("display_name", "Unknown")
    save_user(spotify_id, display_name)

    # Step 3: Sync untuk semua time_range dengan metode BATCH
    time_ranges = ["short_term", "medium_term", "long_term"]
    for time_range in time_ranges:
        artist_resp = requests.get(f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=20", headers=headers)
        artists = artist_resp.json().get("items", [])
        track_resp = requests.get(f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=20", headers=headers)
        tracks = track_resp.json().get("items", [])

        # --- PROSES BATCH DIMULAI ---
        
        # 1. Kumpulkan semua data ke dalam list terlebih dahulu
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
        
        # 2. Kirim data sekaligus ke database dalam beberapa panggilan saja
        save_artists_batch(artists_to_save)
        save_tracks_batch(tracks_to_save)
        save_user_associations_batch("user_artists", "artist_id", spotify_id, artist_ids)
        save_user_associations_batch("user_tracks", "track_id", spotify_id, track_ids)

        # --- PROSES BATCH SELESAI ---

        # 3. Siapkan data untuk cache (setelah semua data tersimpan)
        result = {"user": display_name, "artists": [], "tracks": []}
        for artist in artists:
             result["artists"].append({
                "id": artist["id"], "name": artist["name"], "genres": artist.get("genres", []),
                "popularity": artist["popularity"], "image": artist["images"][0]["url"] if artist.get("images") else ""
            })
        for track in tracks:
            album_image_url = track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else ""
            result["tracks"].append({
                "id": track["id"], "name": track["name"],
                "artists": [a["name"] for a in track.get("artists", [])],
                "album": track["album"]["name"], "popularity": track["popularity"],
                "preview_url": track.get("preview_url"), "image": album_image_url
            })

        # Analisis emosi tetap dilakukan seperti biasa
        track_names = [track['name'] for track in result.get("tracks", [])]
        emotion_paragraph = generate_emotion_paragraph(track_names)
        result['emotion_paragraph'] = emotion_paragraph

        cache_top_data("top", spotify_id, time_range, result)
        save_user_sync(spotify_id, time_range, result)

    # Step 4: Redirect ke dashboard
    original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    frontend_url = f"{request.url.scheme}://{original_host}"
    return RedirectResponse(url=f"{frontend_url}/dashboard/{spotify_id}?time_range=short_term")

@router.get("/sync/top-data", tags=["Sync"])
def sync_top_data(
    access_token: str = Query(..., description="Spotify Access Token"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"], description="Time range")
):
    headers = {"Authorization": f"Bearer {access_token}"}
    res = requests.get("https://api.spotify.com/v1/me", headers=headers)
    
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.json())
        
    user_profile = res.json()
    spotify_id = user_profile["id"]
    display_name = user_profile.get("display_name", "Unknown")
    save_user(spotify_id, display_name) # save_user masih dipakai

    # Mengambil data dari Spotify (tidak berubah)
    artist_resp = requests.get(f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=20", headers=headers)
    artists = artist_resp.json().get("items", [])
    track_resp = requests.get(f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=20", headers=headers)
    tracks = track_resp.json().get("items", [])

    # --- ▼▼▼ PROSES BATCH DIMULAI ▼▼▼ ---

    # 1. Kumpulkan semua data ke dalam list
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

    # 2. Kirim data sekaligus ke database menggunakan fungsi batch
    save_artists_batch(artists_to_save)
    save_tracks_batch(tracks_to_save)
    save_user_associations_batch("user_artists", "artist_id", spotify_id, artist_ids)
    save_user_associations_batch("user_tracks", "track_id", spotify_id, track_ids)

    # --- ▲▲▲ PROSES BATCH SELESAI ▲▲▲ ---

    # 3. Siapkan data untuk response JSON dan cache
    result = {"user": display_name, "artists": [], "tracks": []}
    for artist in artists:
         result["artists"].append({
            "id": artist["id"], "name": artist["name"], "genres": artist.get("genres", []),
            "popularity": artist["popularity"], "image": artist["images"][0]["url"] if artist.get("images") else ""
        })
    for track in tracks:
        album_image_url = track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else ""
        result["tracks"].append({
            "id": track["id"], "name": track["name"],
            "artists": [a["name"] for a in track.get("artists", [])],
            "album": track["album"]["name"], "popularity": track["popularity"],
            "preview_url": track.get("preview_url"), "image": album_image_url
        })
        
    track_names = [track['name'] for track in result.get("tracks", [])]
    emotion_paragraph = generate_emotion_paragraph(track_names)
    result['emotion_paragraph'] = emotion_paragraph

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
        # Jika data belum siap (mungkin saat login pertama kali), tampilkan loading
        return templates.TemplateResponse("loading.html", {"request": request})

    # Ambil paragraf emosi dari data cache. Beri teks default jika tidak ada.
    emotion_paragraph = data.get("emotion_paragraph", "Vibe analysis is getting ready...")
    
    # --- BLOK DATA TOOLTIP & GENRE (TIDAK BERUBAH) ---
    genre_artists_map = {}
    for artist in data.get("artists", []):
        for genre in artist.get("genres", []):
            if genre not in genre_artists_map:
                genre_artists_map[genre] = []
            genre_artists_map[genre].append(artist["name"])
    
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
        "time_range": time_range,
        "genre_artists_map": genre_artists_map,
        "emotion_paragraph": emotion_paragraph  # <-- Kirim data emosi ke template
    })

# Ganti endpoint agar sesuai dengan frontend (POST /analyze-lyrics)
@router.post("/analyze-lyrics", tags=["NLP"])
def analyze_lyrics_emotion_endpoint(
    lyrics: str = Body(..., embed=True, description="Lirik lagu untuk dianalisis")
):
    """
    Analisis emosi dari lirik lagu menggunakan model Hugging Face GoEmotions.
    """
    return analyze_lyrics_emotion(lyrics)

@router.get("/lyrics", response_class=HTMLResponse, tags=["Pages"])
def lyrics_page(request: Request, spotify_id: str = None):
    """
    Serves the lyric analyzer page.
    """
    return templates.TemplateResponse("lyrics.html", {"request": request, "spotify_id": spotify_id})

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def genius_headers():
    return {"Authorization": f"Bearer {GENIUS_TOKEN}"}

@router.get("/genius/search_artist")
def route_search_artist(q: str = Query(..., description="Nama artis")):
    return search_artist(q)

@router.get("/genius/artist_songs")
def route_artist_songs(artist_id: int):
    return artist_songs(artist_id)

@router.get("/genius/song_lyrics")
def route_song_lyrics(song_id: int):
    return song_lyrics(song_id)