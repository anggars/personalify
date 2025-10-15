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

router = APIRouter()
# --- Perbaikan Path Template ---
current_dir = os.path.dirname(os.path.abspath(__file__))
# Naik 2 level ke root project, lalu masuk ke frontend/templates
templates_dir = os.path.join(current_dir, "..", "..", "frontend", "templates")
templates_dir = os.path.abspath(templates_dir)  # Normalize path
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

# Ganti bagian callback function di routes.py dengan ini:

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

    # Step 3: Sync untuk semua time_range
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

        # 4. SKIP ANALISIS EMOSI DI CALLBACK - Berikan teks default saja
        result['emotion_paragraph'] = "Your music vibe is being analyzed..."

        cache_top_data("top", spotify_id, time_range, result)
        save_user_sync(spotify_id, time_range, result)

    # Step 4: Redirect ke dashboard LANGSUNG (lebih cepat!)
    original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    frontend_url = f"{request.url.scheme}://{original_host}"
    return RedirectResponse(url=f"{frontend_url}/dashboard/{spotify_id}?time_range=short_term")

@router.post("/analyze-emotions-background", tags=["Background"])
async def analyze_emotions_background(
    spotify_id: str = Body(..., embed=True, description="Spotify ID"),
    time_range: str = Body("short_term", embed=True, description="Time range"),
    extended: bool = Body(False, embed=True, description="Use extended track list (20 tracks)")
):
    """
    Endpoint terpisah untuk analisis emosi yang bisa dipanggil dari frontend
    setelah dashboard sudah dimuat.
    """
    try:
        # Ambil data dari cache
        cached_data = get_cached_top_data("top", spotify_id, time_range)
        if not cached_data:
            return {"error": "No data found for analysis"}
        
        # Lakukan analisis emosi dengan jumlah track yang berbeda
        tracks_to_analyze = cached_data.get("tracks", [])
        
        # --- PERBAIKAN LOGIKA UTAMA ADA DI SINI ---
        if extended:
            # Jika ini permintaan 'extended' (dari easter egg), gunakan semua track
            track_names = [track['name'] for track in tracks_to_analyze]
        else:
            # Jika ini analisis standar, gunakan hanya 10 track pertama
            track_names = [track['name'] for track in tracks_to_analyze[:10]]
        
        emotion_paragraph = generate_emotion_paragraph(track_names)
        
        # --- LOGIKA PENYIMPANAN YANG DIPERBAIKI ---
        if extended:
            # Jika ini permintaan 'extended', JANGAN simpan hasilnya. 
            # Cukup kembalikan untuk ditampilkan sementara di browser.
            print("Extended analysis requested. Returning temporary result without caching.")
        else:
            # Jika ini analisis standar (Top 10 saat halaman dibuka),
            # baru simpan hasilnya ke cache dan database.
            print("Standard analysis. Updating cache and database.")
            cached_data['emotion_paragraph'] = emotion_paragraph
            cache_top_data("top", spotify_id, time_range, cached_data)
            save_user_sync(spotify_id, time_range, cached_data)
        
        return {"emotion_paragraph": emotion_paragraph}
        
    except Exception as e:
        print(f"Background emotion analysis failed: {e}")
        return {"emotion_paragraph": "Vibe analysis is currently unavailable."}

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
        return templates.TemplateResponse("loading.html", {"request": request})

    emotion_paragraph = data.get("emotion_paragraph", "Vibe analysis is getting ready...")
    
    # --- PERHITUNGAN GENRE UNTUK TOP 10 (DEFAULT) ---
    genre_count_top10 = {}
    genre_artists_map_top10 = {}
    
    for artist in data.get("artists", [])[:10]:  # Hanya 10 artis pertama
        for genre in artist.get("genres", []):
            genre_count_top10[genre] = genre_count_top10.get(genre, 0) + 1
            if genre not in genre_artists_map_top10:
                genre_artists_map_top10[genre] = []
            genre_artists_map_top10[genre].append(artist["name"])
    
    sorted_genres_top10 = sorted(genre_count_top10.items(), key=lambda x: x[1], reverse=True)
    genre_list_top10 = [{"name": name, "count": count} for name, count in sorted_genres_top10]

    # --- PERHITUNGAN GENRE UNTUK TOP 20 (EASTER EGG) ---
    genre_count_top20 = {}
    genre_artists_map_top20 = {}
    
    for artist in data.get("artists", []):  # Semua 20 artis
        for genre in artist.get("genres", []):
            genre_count_top20[genre] = genre_count_top20.get(genre, 0) + 1
            if genre not in genre_artists_map_top20:
                genre_artists_map_top20[genre] = []
            genre_artists_map_top20[genre].append(artist["name"])
    
    sorted_genres_top20 = sorted(genre_count_top20.items(), key=lambda x: x[1], reverse=True)
    genre_list_top20 = [{"name": name, "count": count} for name, count in sorted_genres_top20]

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": data["user"],
        "artists": data["artists"],
        "tracks": data["tracks"],
        "genres": genre_list_top10,  # Default: top 10
        "genres_extended": genre_list_top20,  # Extended: top 20
        "time_range": time_range,
        "genre_artists_map": genre_artists_map_top10,  # Default: top 10
        "genre_artists_map_extended": genre_artists_map_top20,  # Extended: top 20
        "emotion_paragraph": emotion_paragraph
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