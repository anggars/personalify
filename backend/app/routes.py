import os
import requests
import json
import datetime
import asyncio

from urllib.parse import urlencode
from fastapi import APIRouter, Request, Query, HTTPException, Body, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse, Response
from fastapi.templating import Jinja2Templates
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel
from app.nlp_handler import generate_emotion_paragraph, analyze_lyrics_emotion
from app.admin import get_system_wide_stats, get_user_report, export_users_to_csv
from app.db_handler import (
    save_user,
    save_artists_batch,
    save_tracks_batch,
    save_user_associations_batch,
    log_system
)
from app.cache_handler import cache_top_data, get_cached_top_data, clear_top_data_cache
from app.mongo_handler import save_user_sync, get_user_history
from app.qstash_handler import get_qstash_client, get_qstash_receiver
from app.genius_lyrics import get_suggestions, search_artist_id, get_songs_by_artist, get_lyrics_by_id


# Request Access Model
class RequestAccessModel(BaseModel):
    name: str
    email: str

router = APIRouter()
# Templates removed
# templates = Jinja2Templates(directory=templates_dir)

def get_redirect_uri(request: Request):
    host = str(request.headers.get("x-forwarded-host", request.headers.get("host", "")))
    
    # PRIORITIZE Env Var (Fixed URI) to avoid Proxy Host mismatch
    env_redirect = os.getenv("SPOTIFY_REDIRECT_URI")
    if env_redirect and "vercel.app" not in host:
        return env_redirect

    # Vercel production
    if "vercel.app" in host:
        return os.getenv("SPOTIFY_REDIRECT_URI_VERCEL", "https://personalify.vercel.app/callback")
    
    # Fallback: Build callback URL using actual request host
    if host:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        scheme = "https" if "vercel.app" in host or proto == "https" else "http"
        return f"{scheme}://{host}/callback"
    else:
        return "http://127.0.0.1:8000/callback"

@router.get("/", tags=["Root"])
def root():
    return {"status": "ok", "message": "Personalify Backend API"}

@router.post("/request-access", tags=["Admin"])
def request_access(data: RequestAccessModel):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")

    if not bot_token or not chat_id:
        print(f"[MOCK REQUEST] Request from {data.name} ({data.email}) - No Telegram Config")
        return {"status": "ok", "message": "Request received (Mock Mode)"}

    try:
        message = (
            f"**New Access Request!**\n\n"
            f"**Name:** {data.name}\n"
            f"**Email:** {data.email}\n\n"
            f"Please add this email to Spotify Developer Dashboard > Users and Access!"
        )
        
        telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        
        res = requests.post(telegram_url, json=payload)
        
        if res.status_code != 200:
            print(f"TELEGRAM ERROR: {res.text}")
            raise HTTPException(status_code=500, detail="Failed to send notification")
            
        return {"status": "ok", "message": "Request sent successfully"}
    except Exception as e:
        print(f"TELEGRAM EXCEPTION: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/login", tags=["Auth"])
def login(request: Request, mobile: str = Query(None)):
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    redirect_uri = get_redirect_uri(request)
    
    # DEBUG: Print exact redirect_uri
    print(f"DEBUG Login - Redirect URI: {redirect_uri}")
    print(f"DEBUG Login - Request Host: {request.headers.get('host', 'N/A')}")
    print(f"DEBUG Login - Mobile param: {mobile}")
    
    scope = "user-top-read user-read-recently-played user-read-private user-read-email"
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Spotify client_id or redirect_uri not configured.")
    
    # Pass mobile param through state parameter
    # Ensure state is URL-safe and clearly indicates mobile
    state = "mobile=true" if mobile and mobile.lower() == "true" else "web"
    
    query_params = urlencode({
        "response_type": "code", "client_id": client_id,
        "redirect_uri": redirect_uri, "scope": scope,
        "state": state
    })
    return RedirectResponse(url=f"https://accounts.spotify.com/authorize?{query_params}")

@router.get("/logout")
async def logout(request: Request):
    try:
        request.session.clear()
    except Exception as e:
        print(f"LOGOUT WARNING: {e}") 
    response = RedirectResponse(url="/?error=logged_out", status_code=303)
    response.delete_cookie("spotify_id", path="/")
    return response

@router.get("/callback", tags=["Auth"])
def callback(request: Request, code: str = Query(..., description="Spotify Authorization Code"), state: str = Query(None)):
    
    # 1. Determine Client Type & Host immediately
    original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    # State format: "mobile=true" (Wait, mobile sends state="mobile=true"?)
    # If state is None, is_mobile is False.
    is_mobile = state and "mobile=true" in state
    
    # helper to get frontend url
    if "127.0.0.1" in original_host or "localhost" in original_host:
        frontend_url = "http://localhost:3000"
    else:
        frontend_url = f"{request.url.scheme}://{original_host}"

    def error_redirect(reason: str):
        if is_mobile:
            return RedirectResponse(
                url=f"personalify://callback?error={reason}",
                status_code=303
            )
        else:
            return RedirectResponse(
                url=f"{frontend_url}/?error={reason}",
                status_code=303
            )

    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = get_redirect_uri(request)

    payload = {
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
        "client_id": client_id, "client_secret": client_secret
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    
    try:
        res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
        if res.status_code != 200:
            print(f"AUTH ERROR: Token Exchange Failed: {res.text}")
            return error_redirect("token_error")
            
        tokens = res.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return error_redirect("no_access_token")

        headers = {"Authorization": f"Bearer {access_token}"}
        user_res = requests.get("https://api.spotify.com/v1/me", headers=headers)
        if user_res.status_code != 200:
            print(f"AUTH ERROR: Profile Fetch Failed: {user_res.text}")
            # Likely not whitelisted
            return error_redirect("access_denied") # "User not registered..." usually is 403 here?
            
        user_profile = user_res.json()
        spotify_id = user_profile["id"]
        display_name = user_profile.get("display_name", "Unknown")
        # FIX: Get User Image
        user_image = user_profile["images"][0]["url"] if user_profile.get("images") else None
        save_user(spotify_id, display_name)

        time_ranges = ["short_term", "medium_term", "long_term"]
        for time_range in time_ranges:
            artist_resp = requests.get(f"https://api.spotify.com/v1/me/top/artists?time_range={time_range}&limit=20", headers=headers)
            artists = artist_resp.json().get("items", [])
            track_resp = requests.get(f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit=20", headers=headers)
            tracks = track_resp.json().get("items", [])

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

            # FIX: Include image in result
            result = {"user": display_name, "image": user_image, "artists": [], "tracks": []}
            for artist in artists:
                 result["artists"].append({
                    "id": artist["id"], "name": artist["name"], "genres": artist.get("genres", []),
                    "popularity": artist["popularity"], "image": artist["images"][0]["url"] if artist.get("images") else ""
                })
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

            result['emotion_paragraph'] = "Your music vibe is being analyzed..."
            cache_top_data("top_v2", spotify_id, time_range, result)
            save_user_sync(spotify_id, time_range, result)
            
    except Exception as e:
        print(f"AUTH EXCEPTION: {e}")
        return error_redirect("server_error")
    
    # Success Redirect
    print(f"DEBUG Callback - State: {state}, is_mobile: {is_mobile}")
    if is_mobile:
        # Mobile app - redirect to deep link (no cookies needed for mobile)
        # CRITICAL: Include access_token so mobile can call /sync/top-data
        log_system("AUTH", f"Mobile User Login Success: {display_name}", "FLUTTER")
        return RedirectResponse(
            url=f"personalify://callback?spotify_id={spotify_id}&access_token={access_token}",
            status_code=303
        )
    else:
        # Web app - existing flow
        # For local development, redirect to Next.js frontend on port 3000
        log_system("AUTH", f"User Login Success: {display_name}", "SPOTIFY")
        response = RedirectResponse(url=f"{frontend_url}/dashboard/{spotify_id}?time_range=short_term")
        # CRITICAL FIX: Set cookie path to "/" so it is accessible on all routes
        # Also set SameSite to Lax to prevent some browser blocking
        response.set_cookie(key="spotify_id", value=spotify_id, httponly=True, path="/", samesite="lax")
        # NEW: Set access_token cookie for realtime sync logic (Web only)
        response.set_cookie(key="access_token", value=access_token, httponly=True, path="/", samesite="lax", max_age=3600)
        return response

@router.post("/analyze-emotions-background", tags=["Background"])
async def analyze_emotions_background(
    spotify_id: str = Body(..., embed=True, description="Spotify ID"),
    time_range: str = Body("short_term", embed=True, description="Time range"),
    extended: bool = Body(False, embed=True, description="Use extended track list (20 tracks)")
):

    try:
        cached_data = get_cached_top_data("top_v2", spotify_id, time_range)
        if not cached_data:
            return {"error": "No data found for analysis"}
        tracks_to_analyze = cached_data.get("tracks", [])
        if extended:
            track_names = [track['name'] for track in tracks_to_analyze]
        else:
            track_names = [track['name'] for track in tracks_to_analyze[:10]]
        emotion_paragraph, top_emotions = generate_emotion_paragraph(track_names, extended=extended)

        if extended:

            print("EXTENDED ANALYSIS REQUESTED. RETURNING TEMPORARY RESULT WITHOUT CACHING.")
        else:

            print("STANDARD ANALYSIS. UPDATING CACHE AND DATABASE.")
            cached_data['emotion_paragraph'] = emotion_paragraph
            cached_data['top_emotions'] = top_emotions
            cache_top_data("top_v2", spotify_id, time_range, cached_data)
            save_user_sync(spotify_id, time_range, cached_data)

        return {"emotion_paragraph": emotion_paragraph, "top_emotions": top_emotions}

    except Exception as e:
        print(f"BACKGROUND EMOTION ANALYSIS FAILED: {e}")
        return {"emotion_paragraph": "Vibe analysis is currently unavailable."}

@router.post("/analyze-lyrics", tags=["NLP"])
async def analyze_lyrics(
    lyrics: str = Body(..., embed=True, description="Lyrics text to analyze")
):
    """
    Analyze emotions from raw lyrics text.
    """
    return analyze_lyrics_emotion(lyrics)

from app.spotify_handler import sync_user_data

@router.get("/sync/top-data", tags=["Sync"])
def sync_top_data(
    access_token: str = Query(..., description="Spotify Access Token"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"], description="Time range")
):
    try:
        return sync_user_data(access_token, time_range)
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"SYNC WRAPPER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Sync failed.")

@router.get("/top-data", tags=["Query"])
def get_top_data(
    spotify_id: str = Query(..., description="Spotify ID"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"]),
    limit: int = Query(10, ge=1),
    sort: str = Query("popularity")
):
    data = get_cached_top_data("top_v2", spotify_id, time_range)
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
    data = get_cached_top_data("top_v2", spotify_id, time_range)
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
    try:
        data = get_cached_top_data("top_v2", spotify_id, time_range)
        if not data:
            return RedirectResponse(url="/?error=session_expired")

        emotion_paragraph = data.get("emotion_paragraph", "Vibe analysis is getting ready...")
        analytics = data.get("analytics") 

        genre_count_top10 = {}
        genre_artists_map_top10 = {}
        for artist in data.get("artists", [])[:10]:
            for genre in artist.get("genres", []):
                genre_count_top10[genre] = genre_count_top10.get(genre, 0) + 1
                if genre not in genre_artists_map_top10:
                    genre_artists_map_top10[genre] = []
                genre_artists_map_top10[genre].append(artist["name"])
        sorted_genres_top10 = sorted(genre_count_top10.items(), key=lambda x: x[1], reverse=True)
        genre_list_top10 = [{"name": name, "count": count} for name, count in sorted_genres_top10]

        genre_count_top20 = {}
        genre_artists_map_top20 = {}
        for artist in data.get("artists", []):
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
            "spotify_id": spotify_id,
            "artists": data["artists"],
            "tracks": data["tracks"],
            "genres": genre_list_top10,
            "genres_extended": genre_list_top20,
            "time_range": time_range,
            "genre_artists_map": genre_artists_map_top10,
            "genre_artists_map_extended": genre_artists_map_top20,
            "emotion_paragraph": emotion_paragraph,
            "analytics": analytics
        })

    except Exception as e:
        print(f"DASHBOARD CRASH: {e}")
        raise HTTPException(status_code=500, detail="Internal Dashboard Error")

@router.get("/api/dashboard/{spotify_id}", tags=["Dashboard API"])
def dashboard_api(spotify_id: str, request: Request, time_range: str = "medium_term"):
    """JSON API endpoint for Next.js dashboard"""
    try:
        # NEW: Check for access_token cookie to perform REALTIME SYNC (Matches Mobile Behavior)
        access_token = request.cookies.get("access_token")
        
        if access_token:
            print(f"WEB DASHBOARD: Found access_token. Syncing fresh data for {spotify_id}...")
            try:
                # Sync fresh data directly
                data = sync_user_data(access_token, time_range)
                print("WEB DASHBOARD: Sync success!")
            except Exception as e:
                print(f"WEB DASHBOARD: Sync failed ({e}). Falling back to cache.")
                data = get_cached_top_data("top_v2", spotify_id, time_range)
        else:
            print(f"WEB DASHBOARD: No access_token. Reading from cache for {spotify_id}.")
            data = get_cached_top_data("top_v2", spotify_id, time_range)

        if not data:
            raise HTTPException(status_code=404, detail="No data found. Please login again.")

        emotion_paragraph = data.get("emotion_paragraph", "Vibe analysis is getting ready...")

        # Calculate genres from ALL artists (legacy behavior used all for extended list)
        genre_count = {}
        genre_artists_map = {}
        for artist in data.get("artists", []):
            for genre in artist.get("genres", []):
                genre_count[genre] = genre_count.get(genre, 0) + 1
                if genre not in genre_artists_map:
                    genre_artists_map[genre] = []
                genre_artists_map[genre].append(artist["name"])
        
        sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
        genre_list = [{"name": name, "count": count} for name, count in sorted_genres]

        return {
            "user": data["user"],
            "time_range": time_range,
            "emotion_paragraph": emotion_paragraph,
            "top_emotions": data.get("top_emotions", []),
            "artists": data.get("artists", []),
            "tracks": data.get("tracks", []),
            "genres": genre_list,
            "genre_artists_map": genre_artists_map
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"DASHBOARD API CRASH: {e}")
        raise HTTPException(status_code=500, detail="Internal Dashboard Error")

@router.get("/about", response_class=HTMLResponse, tags=["Pages"])
def about_page(request: Request): 
    spotify_id = request.cookies.get("spotify_id")
    return templates.TemplateResponse("about.html", {
        "request": request,
        "spotify_id": spotify_id
        })

@router.get("/admin/system-stats", tags=["Admin"])
def get_stats():
    try:
        stats = get_system_wide_stats()
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        RECEIPT_WIDTH = 40

        def format_line(key, value):
            key_str = str(key)
            value_str = str(value)

            padding = RECEIPT_WIDTH - len(key_str) - len(value_str) - 2 - 2
            if padding < 1: padding = 1
            return f" {key_str}{'.' * padding}{value_str} "

        receipt_lines = []
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append("      PERSONALIFY SYSTEM AUDIT      ")
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append(f" DATE: {now}")
        receipt_lines.append("=" * RECEIPT_WIDTH)

        receipt_lines.append("\n--- POSTGRESQL (MAIN DB) ---")
        receipt_lines.append(format_line("Total Users", stats.get('total_users', 'N/A')))
        receipt_lines.append(format_line("Total Artists", stats.get('total_unique_artists', 'N/A')))
        receipt_lines.append(format_line("Total Tracks", stats.get('total_unique_tracks', 'N/A')))

        receipt_lines.append("\n  Top 5 Artists (All Users):")
        for item in stats.get('most_popular_artists', ["N/A"]):
            receipt_lines.append(f"    - {item}")

        receipt_lines.append("\n  Top 5 Tracks (All Users):")
        for item in stats.get('most_popular_tracks', ["N/A"]):
            receipt_lines.append(f"    - {item}")

        receipt_lines.append("\n" + "=" * RECEIPT_WIDTH)
        receipt_lines.append("--- MONGODB (SYNC HISTORY) ---")
        receipt_lines.append(format_line("Synced Users Count", stats.get('mongo_synced_users_count', 'N/A')))

        receipt_lines.append("\n  Synced User List:")
        for item in stats.get('mongo_synced_user_list', ["N/A"]):
            receipt_lines.append(f"    - {item}")

        receipt_lines.append("\n" + "=" * RECEIPT_WIDTH)
        receipt_lines.append("--- REDIS (CACHE) ---")
        receipt_lines.append(format_line("Cached Keys Count", stats.get('redis_cached_keys_count', 'N/A')))

        receipt_lines.append("\n  Sample Cached Keys:")
        for item in stats.get('redis_sample_keys', ["N/A"]):
            receipt_lines.append(f"    - {item}")

        receipt_lines.append("\n" + "*" * RECEIPT_WIDTH)
        receipt_lines.append("         THANK YOU - ADMIN        ")
        receipt_lines.append("*" * RECEIPT_WIDTH)

        report_string = "\n".join(receipt_lines)

        return Response(content=report_string, media_type="text/plain")

    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE SYSTEM-WIDE STATS AT ENDPOINT: {e}")
        return Response(
            content=f"FAILED TO RETRIEVE SYSTEM-WIDE STATS: {str(e)}", 
            media_type="text/plain", 
            status_code=500
        )

@router.get("/admin/clear-cache", tags=["Admin"])
def clear_cache():
    try:
        deleted_count = clear_top_data_cache()
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        RECEIPT_WIDTH = 40

        def format_line(key, value):
            key_str = str(key)
            value_str = str(value)
            padding = RECEIPT_WIDTH - len(key_str) - len(value_str) - 2 - 2
            if padding < 1: padding = 1
            return f" {key_str}{'.' * padding}{value_str} "

        receipt_lines = []
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append("      PERSONALIFY CACHE FLUSH     ")
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append(f" DATE: {now}")
        receipt_lines.append("=" * RECEIPT_WIDTH)
        receipt_lines.append("\n  STATUS: SUCCESS\n")
        receipt_lines.append(format_line("TOTAL KEYS DELETED", deleted_count))
        receipt_lines.append("\n\n" + "=" * RECEIPT_WIDTH)
        receipt_lines.append("        CACHE IS NOW EMPTY        ")
        receipt_lines.append("=" * RECEIPT_WIDTH)

        report_string = "\n".join(receipt_lines)

        return Response(content=report_string, media_type="text/plain")

    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO CLEAR CACHE: {e}")
        return Response(
            content=f"FAILED TO CLEAR CACHE: {str(e)}", 
            media_type="text/plain", 
            status_code=500
        )

@router.get("/admin/user-report/{spotify_id}", tags=["Admin"])
def get_user_stats(spotify_id: str):
    try:
        details = get_user_report(spotify_id)
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        RECEIPT_WIDTH = 40

        def format_line(key, value):
            key_str = str(key)
            value_str = str(value)
            padding = RECEIPT_WIDTH - len(key_str) - len(value_str) - 2 - 2
            if padding < 1: padding = 1
            return f" {key_str}{'.' * padding}{value_str} "

        receipt_lines = []
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append("       PERSONALIFY USER REPORT      ")
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append(f" DATE: {now}")
        receipt_lines.append("=" * RECEIPT_WIDTH)

        if "error" in details:
             receipt_lines.append(f"\n  ERROR: {details['error']}\n")

        receipt_lines.append(format_line("User", details.get('display_name', 'N/A')))
        receipt_lines.append(format_line("Spotify ID", details.get('spotify_id', 'N/A')))

        receipt_lines.append("\n  Top 5 Artists (from DB):")
        artists = details.get('db_top_artists', [])
        if not artists:
            receipt_lines.append("    - No artists found in DB -")
        for item in artists:
            receipt_lines.append(f"    - {item}")

        receipt_lines.append("\n  Top 5 Tracks (from DB):")
        tracks = details.get('db_top_tracks', [])
        if not tracks:
            receipt_lines.append("    - No tracks found in DB -")
        for item in tracks:
            receipt_lines.append(f"    - {item}")

        receipt_lines.append("\n" + "*" * RECEIPT_WIDTH)
        receipt_lines.append("         END OF REPORT        ")
        receipt_lines.append("*" * RECEIPT_WIDTH)

        report_string = "\n".join(receipt_lines)

        return Response(content=report_string, media_type="text/plain")

    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE USER REPORT AT ENDPOINT: {e}")
        return Response(
            content=f"FAILED TO RETRIEVE USER REPORT: {str(e)}", 
            media_type="text/plain", 
            status_code=500
        )

@router.get("/admin/export-users", tags=["Admin"])
def download_user_export():
    csv_content = export_users_to_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=personalify_users_light.csv"
        }
    )

@router.post("/analyze-lyrics", tags=["NLP"])
def analyze_lyrics_emotion_endpoint(
    lyrics: str = Body(..., embed=True, description="Song lyrics to analyze")
):
    snippet = lyrics[:30] + "..." if len(lyrics) > 30 else lyrics
    log_system("NLP", f"Analyzing Text: '{snippet}'", "HUGGINGFACE")
    return analyze_lyrics_emotion(lyrics)

@router.get("/lyrics", response_class=HTMLResponse, tags=["Pages"])
def lyrics_page(request: Request):
    spotify_id = request.cookies.get("spotify_id")
    return templates.TemplateResponse("lyrics.html", {
        "request": request,
        "spotify_id": spotify_id
        })

@router.get("/lyrics/genius", response_class=HTMLResponse, tags=["Pages"])
async def read_genius_page(request: Request):
    spotify_id = request.cookies.get("spotify_id")
    return templates.TemplateResponse("genius.html", {
        "request": request,
        "spotify_id": spotify_id
    })

@router.get("/api/genius/search-artist")
def api_search_artist(q: str):
    log_system("SEARCH", f"Searching Artist: '{q}'", "GENIUS")
    return {"artists": search_artist_id(q)}

@router.get("/api/genius/autocomplete")
def api_genius_autocomplete(q: str):
    return {"results": get_suggestions(q)}

@router.get("/api/genius/artist-songs/{artist_id}")
def api_get_artist_songs(artist_id: int):
    return {"songs": get_songs_by_artist(artist_id)}

@router.get("/api/genius/lyrics/{song_id}")
def api_get_lyrics_emotion(song_id: int):
    data = get_lyrics_by_id(song_id)
    if not data:
        log_system("WARN", f"Lyrics Not Found: ID {song_id}", "GENIUS")
        raise HTTPException(status_code=404, detail="Lyrics not found!")
    log_system("LYRICS", f"Fetched: {data.get('title')}", "SCRAPER")
    print("="*50)
    print(f"ANALYSIS REQUEST: {data.get('title')} - {data.get('artist')}")
    print("-" * 20)
    print(f"LYRICS CONTENT:\n{data.get('lyrics')}")
    print("="*50)
    emotion = analyze_lyrics_emotion(data['lyrics'])
    return {
        "track_info": data, 
        "lyrics": data['lyrics'],
        "emotion_analysis": emotion
    }

async def run_analysis_logic(spotify_id: str):
    print(f"[START] Processing analysis for: {spotify_id}")
    await asyncio.sleep(2)
    print(f"[FINISH] Analysis complete for: {spotify_id}")

@router.post("/start-background-analysis")
async def start_background_analysis(
    spotify_id: str, 
    background_tasks: BackgroundTasks
):
    app_url = os.getenv("APP_URL", "http://127.0.0.1:8000")
    token = os.getenv("QSTASH_TOKEN")
    print(f"[DEBUG] APP_URL that's read: '{app_url}'")
    print(f"[DEBUG] Token contains any content? {'YES' if token else 'EMPTY'}")
    if not token:
        print("[CRITICAL ERROR] QSTASH_TOKEN EMPTY IN VERCEL!")
    if "127.0.0.1" in app_url or "localhost" in app_url:
        print("Local Mode: Bypass QStash.")
        background_tasks.add_task(run_analysis_logic, spotify_id)
        return {"status": "Processing locally"}
    else:
        print(f"Production: Sending to QStash via MANUAL HTTP REQUEST...")
        target_url = f"{app_url}/api/tasks/process-analysis"
        qstash_url = f"https://qstash.upstash.io/v2/publish/{target_url}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(
                qstash_url,
                headers=headers,
                data=json.dumps({"spotify_id": spotify_id})
            )
            
            if 200 <= response.status_code < 300:
                return {"status": "Task queued", "details": response.json()}
            else:
                print(f"QStash Nolak: {response.text}")
                return {"status": "QStash Failed", "error": response.text}
        except Exception as e:
            print(f"Connection Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/tasks/process-analysis")
async def process_analysis_task(request: Request):
    receiver = get_qstash_receiver()
    signature = request.headers.get("Upstash-Signature")
    body_bytes = await request.body()
    try:
        receiver.verify(
            body=body_bytes.decode("utf-8"),
            signature=signature,
            url=str(request.url)
        )
    except Exception as e:
        print(f"INVALID SIGNATURE: {e}")
        raise HTTPException(status_code=401, detail="Invalid signature")
    data = await request.json()
    spotify_id = data.get("spotify_id")
    await run_analysis_logic(spotify_id)
    return {"status": "Processed"}

@router.post("/fire-qstash-event")
async def fire_qstash_event(
    request: Request,
    background_tasks: BackgroundTasks
):
    body = await request.json()
    action = body.get("action", "unknown_action")
    metadata = body.get("metadata", {})
    app_url = os.getenv("APP_URL", "http://127.0.0.1:8000")
    token = os.getenv("QSTASH_TOKEN")
    if "127.0.0.1" in app_url or "localhost" in app_url:
        return {"status": "Logged locally"}
    else:
        target_url = f"{app_url}/api/tasks/log-activity"
        qstash_url = f"https://qstash.upstash.io/v2/publish/{target_url}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        try:
            requests.post(
                qstash_url,
                headers=headers,
                data=json.dumps({"action": action, "data": metadata})
            )
            return {"status": "Sent to QStash (Manual)"}
        except Exception as e:
            print(f"QStash Error: {e}")
            return {"status": "Failed"}

@router.post("/api/tasks/log-activity")
async def log_activity_task(request: Request):
    receiver = get_qstash_receiver()
    signature = request.headers.get("Upstash-Signature")
    body_bytes = await request.body()
    try:
        receiver.verify(
            body=body_bytes.decode("utf-8"),
            signature=signature,
            url=str(request.url)
        )
    except Exception as e:
        return {"status": "Ignored"}
    data = await request.json()
    print(f"Activity Logged: {data.get('action')}")
    return {"status": "Activity Logged"}

@router.get("/api/spotify/recently-played", tags=["Spotify Data"])
def get_recently_played(request: Request, limit: int = 50):
    # Extract Access Token from Header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    access_token = auth_header.split(" ")[1]

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"https://api.spotify.com/v1/me/player/recently-played?limit={limit}"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
             raise HTTPException(status_code=response.status_code, detail=f"Spotify API Error: {response.text}")
        
        data = response.json()
        items = data.get("items", [])
        
        result = []
        for item in items:
            track = item.get("track", {})
            played_at = item.get("played_at")
            
            # Simple Image (Smallest)
            images = track.get("album", {}).get("images", [])
            image_url = images[-1]["url"] if images else "" # Smallest is usually last
            
            result.append({
                "played_at": played_at,
                "track_name": track.get("name", "Unknown"),
                "artist_name": track.get("artists", [{}])[0].get("name", "Unknown"),
                "image_url": image_url,
                "spotify_url": track.get("external_urls", {}).get("spotify", ""),
                "album_name": track.get("album", {}).get("name", ""),
                "album_type": track.get("album", {}).get("album_type", "album"),
                "total_tracks": track.get("album", {}).get("total_tracks", 0)
            })
            
        return result

    except Exception as e:
        print(f"Error fetching recently played: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/user-profile", tags=["Spotify Data"])
def get_user_profile_detail(request: Request):
    """
    Get detailed user profile directly from Spotify /v1/me
    Includes: Display Name, Followers, Product, Country, Image
    """
    # Extract Access Token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    access_token = auth_header.split(" ")[1]
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get("https://api.spotify.com/v1/me", headers=headers)
        if response.status_code != 200:
             raise HTTPException(status_code=response.status_code, detail=f"Spotify API Error: {response.text}")
        
        data = response.json()
        
        # Parse Image (Get largest)
        images = data.get("images", [])
        image_url = images[0]["url"] if images else ""
        
        result = {
            "display_name": data.get("display_name", "Spotify User"),
            "id": data.get("id"),
            "followers": data.get("followers", {}).get("total", 0),
            "country": data.get("country", "Unknown"),
            "product": data.get("product", "free"),
            "image_url": image_url,
            "email": data.get("email", "")
        }
        return result

    except Exception as e:
        print(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))
