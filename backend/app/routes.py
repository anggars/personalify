import os
import requests
import json
import datetime
from datetime import timezone
import asyncio

from urllib.parse import urlencode
from fastapi import APIRouter, Request, Query, HTTPException, Body, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse, Response, PlainTextResponse
from fastapi.templating import Jinja2Templates
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel
from app.nlp_handler import generate_sentiment_analysis, analyze_lyrics_emotion
from app.admin import get_system_wide_stats, get_user_report, export_users_to_csv
from app.db_handler import (
    save_user,
    save_artists_batch,
    save_tracks_batch,
    save_user_associations_batch,
    log_system,
    save_refresh_token,
    get_refresh_token
)
from app.cache_handler import cache_top_data, get_cached_top_data, clear_top_data_cache, r as redis_client
from app.mongo_handler import save_user_sync, get_user_history, get_active_provider, set_active_provider
from app.qstash_handler import get_qstash_client, get_qstash_receiver
from app.genius_lyrics import get_suggestions, search_artist_id, get_songs_by_artist, get_lyrics_by_id
from app.lastfm_handler import sync_lastfm_user_data


# Request Access Model
class RequestAccessModel(BaseModel):
    name: str
    email: str

router = APIRouter()
# Templates removed
# templates = Jinja2Templates(directory=templates_dir)

# Global cache for log deduplication
_last_logged_track = {}

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

def get_lastfm_redirect_uri(request: Request):
    host = str(request.headers.get("x-forwarded-host", request.headers.get("host", "")))
    if "vercel.app" in host:
        return "https://personalify.vercel.app/lastfm/callback"
    
    if host:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        scheme = "https" if "vercel.app" in host or proto == "https" else "http"
        return f"{scheme}://{host}/lastfm/callback"
    else:
        return "http://127.0.0.1:8000/lastfm/callback"

@router.get("/", tags=["Root"])
def root():
    return {"status": "ok", "message": "Personalify Backend API"}

@router.get("/api/debug-cookies", tags=["Debug"])
def debug_cookies(request: Request):
    """Debug endpoint to check what cookies are received by backend"""
    return {
        "cookies": request.cookies,
        "headers": {
            "origin": request.headers.get("origin"),
            "referer": request.headers.get("referer"),
            "host": request.headers.get("host"),
            "cookie_header_raw": request.headers.get("cookie")
        }
    }

@router.get("/api/me", tags=["Auth"])
def get_me(request: Request):
    """Get current user's Spotify ID from cookies"""
    spotify_id = request.cookies.get("spotify_id")
    if not spotify_id:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})
    return {"spotify_id": spotify_id}
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
    # 1. CHECK SYSTEM-WIDE ACTIVE PROVIDER
    active_provider = get_active_provider()
    
    # 2. IF LAST.FM IS ACTIVE, REDIRECT TO LAST.FM FLOW
    if active_provider == "lastfm":
        print("DEBUG Login - System is in Last.fm mode. Redirecting...")
        return RedirectResponse(url="/lastfm/login")

    # 3. SPOTIFY FLOW
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    redirect_uri = get_redirect_uri(request)
    
    # DEBUG: Print exact redirect_uri
    print(f"DEBUG Login - Redirect URI: {redirect_uri}")
    print(f"DEBUG Login - Request Host: {request.headers.get('host', 'N/A')}")
    print(f"DEBUG Login - Mobile param: {mobile}")
    
    scope = "user-top-read user-read-recently-played user-read-private user-read-email user-read-currently-playing user-read-playback-state"
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Spotify client_id or redirect_uri not configured.")
    
    # Pass mobile param through state parameter
    state_val = f"mobile={mobile}" if mobile else "web"
    
    auth_url = "https://accounts.spotify.com/authorize?" + urlencode({
        "response_type": "code",
        "client_id": client_id,
        "scope": scope,
        "redirect_uri": redirect_uri,
        "state": state_val
    })
    
    return RedirectResponse(auth_url)

@router.get("/logout")
async def logout(request: Request):
    """
    Clears all auth cookies and Redis user cache, then redirects to home.
    """
    spotify_id = request.cookies.get("spotify_id")
    lastfm_username = request.cookies.get("lastfm_username")  # e.g. "anggarnts"
    
    try:
        from app.cache_handler import hard_clear_user_cache
        if spotify_id:
            cleared = hard_clear_user_cache(spotify_id)
            print(f"LOGOUT: Hard cleared {cleared} cache keys for Spotify user '{spotify_id}'")
        if lastfm_username:
            lastfm_id = f"lastfm:{lastfm_username}"
            cleared = hard_clear_user_cache(lastfm_id)
            print(f"LOGOUT: Hard cleared {cleared} cache keys for Last.fm user '{lastfm_id}'")
    except Exception as e:
        print(f"LOGOUT WARNING: Cache clear failed: {e}") 
        
    # Get base URL for absolute redirect
    original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    scheme = "https" if "vercel.app" in original_host or proto == "https" else "http"
    base_url = f"{scheme}://{original_host}"

    response = RedirectResponse(url=f"{base_url}/?error=logged_out", status_code=303)
    
    # Delete all possible auth cookies
    response.delete_cookie("spotify_id", path="/")
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("lastfm_session", path="/")
    response.delete_cookie("lastfm_username", path="/")
    
    return response

@router.get("/lastfm/login", tags=["Auth"])
def lastfm_login(request: Request):
    api_key = os.getenv("LASTFM_API_KEY")
    cb_url = get_lastfm_redirect_uri(request)
    auth_url = f"http://www.last.fm/api/auth/?api_key={api_key}&cb={cb_url}"
    return RedirectResponse(auth_url)

@router.get("/lastfm/callback", tags=["Auth"])
def lastfm_callback(request: Request, token: str = Query(...)):
    from app.lastfm_handler import get_session_key
    session_data = get_session_key(token)
    if not session_data or "session" not in session_data:
        return RedirectResponse(url="/?error=lastfm_auth_failed")
    
    username = session_data["session"]["name"]
    session_key = session_data["session"]["key"]
    
    # Set cookies
    original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    is_local = "127.0.0.1" in original_host or "localhost" in original_host
    is_secure = not is_local
    
    # Hard clear: wipes dashboard + NLP analysis cache for fresh re-analysis on login
    try:
        from app.cache_handler import hard_clear_user_cache
        hard_clear_user_cache(f"lastfm:{username}")
    except Exception as e:
        print(f"CACHE HARD CLEAR ERROR on Last.fm Login: {e}")
    
    # helper to get frontend url dynamically
    if "127.0.0.1" in original_host:
        frontend_url = "http://127.0.0.1:3000"
    elif "localhost" in original_host:
        frontend_url = "http://localhost:3000"
    else:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        scheme = "https" if "vercel.app" in original_host or proto == "https" else "http"
        frontend_url = f"{scheme}://{original_host}"

    response = RedirectResponse(url=f"{frontend_url}/dashboard/lastfm:{username}?sync=true")
    
    # We use 'spotify_id' cookie for dashboard lookup, and 'lastfm_session' for scrobbling persistence
    response.set_cookie(key="spotify_id", value=f"lastfm:{username}", httponly=True, path="/", samesite="lax", max_age=31536000, secure=is_secure)
    response.set_cookie(key="lastfm_session", value=session_key, httponly=True, path="/", samesite="lax", max_age=31536000, secure=is_secure)
    response.set_cookie(key="lastfm_username", value=username, httponly=True, path="/", samesite="lax", max_age=31536000, secure=is_secure)
    
    return response

@router.get("/callback", tags=["Auth"])
def callback(request: Request, code: str = Query(..., description="Spotify Authorization Code"), state: str = Query(None)):
    
    # helper to check if running on mobile from state
    is_mobile = False
    if state and "mobile=true" in state:
        is_mobile = True
        
    redirect_uri = get_redirect_uri(request)
    print(f"DEBUG Callback - Redirect URI used: {redirect_uri}")

    # Determine original host to decide frontend URL
    original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    
    # helper to get frontend url dynamically
    # CRITICAL: Match the domain we are currently on to avoid Cross-Domain cookie loss
    # If we are on 127.0.0.1, send to 127.0.0.1:3000. If localhost, send to localhost:3000.
    if "127.0.0.1" in original_host:
        frontend_url = "http://127.0.0.1:3000"
    elif "localhost" in original_host:
        frontend_url = "http://localhost:3000"
    else:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        scheme = "https" if "vercel.app" in original_host or proto == "https" else "http"
        frontend_url = f"{scheme}://{original_host}"

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
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        
        if not access_token:
            return error_redirect("no_access_token")
        
        # Calculate token expiry time (use UTC timezone-aware datetime)
        token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)

        headers = {"Authorization": f"Bearer {access_token}"}
        user_res = requests.get("https://api.spotify.com/v1/me", headers=headers)
        if user_res.status_code != 200:
            print(f"AUTH ERROR: Profile Fetch Failed: {user_res.text}")
            # Likely not whitelisted
            return error_redirect("access_denied") # "User not registered..." usually is 403 here?
            
        user_profile = user_res.json()
        spotify_id = user_profile["id"]
        display_name = user_profile.get("display_name", "Unknown")
        user_image = user_profile["images"][0]["url"] if user_profile.get("images") else None
        
        save_user(spotify_id, display_name)
        
        # NEW: Force fresh sync by clearing existing cache for this user during login
        try:
            from app.cache_handler import hard_clear_user_cache
            hard_clear_user_cache(spotify_id)
            print(f"CALLBACK: Hard cleared cache (dashboard + NLP analysis) for {spotify_id}")
        except Exception as e:
            print(f"CACHE HARD CLEAR ERROR on Spotify Login: {e}")

        # Save refresh token if available
        if refresh_token:
            save_refresh_token(spotify_id, refresh_token, token_expires_at)

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

            result['sentiment_report'] = "Your music vibe is being analyzed..."
            cache_top_data("top", spotify_id, time_range, result)
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
        response = RedirectResponse(url=f"{frontend_url}/dashboard/{spotify_id}?sync=true")
        
        # Determine if running locally for cookie domain
        # CRITICAL: For localhost, DO NOT set domain parameter!
        # Setting domain="localhost" breaks cookies when accessing via 127.0.0.1
        # Let browser handle same-origin policy for local development
        is_local = "127.0.0.1" in original_host or "localhost" in original_host
        cookie_domain = None if is_local else None  # Always None - browser auto-detects
        
        # CRITICAL FIX: Set cookie WITHOUT domain for localhost
        # This allows cookies to work for both localhost:3000 and 127.0.0.1:3000
        # Secure=True for production (HTTPS), False for local (HTTP)
        is_secure = not is_local
        
        # USE HTML REDIRECT INSTEAD OF 307 TO FORCE COOKIE SET
        # Browsers sometimes drop cookies on cross-site 3xx redirects
        redirect_url = f"{frontend_url}/dashboard/{spotify_id}?time_range=short_term"
        
        html_content = f"""
        <html>
            <head>
                <title>Redirecting...</title>
                <script>
                    window.location.replace("{redirect_url}");
                </script>
            </head>
            <body>
                <p>Login successful! Redirecting to dashboard...</p>
            </body>
        </html>
        """
        
        response = HTMLResponse(content=html_content, status_code=200)

        response.set_cookie(
            key="spotify_id", 
            value=spotify_id, 
            httponly=True, 
            path="/", 
            samesite="lax",
            max_age=2592000,  # 30 days
            secure=is_secure
        )
        # NEW: Set access_token cookie for realtime sync logic (Web only)
        response.set_cookie(
            key="access_token", 
            value=access_token, 
            httponly=True, 
            path="/", 
            samesite="lax", 
            max_age=3600,
            secure=is_secure
        )
        return response

class RefreshRequest(BaseModel):
    spotify_id: str

@router.post("/auth/refresh", tags=["Auth"])
def refresh_access_token(
    request: Request,
    data: Optional[RefreshRequest] = Body(None)
):
    """
    Refresh access token using stored refresh_token.
    - Mobile: sends spotify_id in JSON body
    - Web: sends cookie (fallback to cookie if body is empty)
    """
    spotify_id = data.spotify_id if data else None

    # Fallback to cookie
    if not spotify_id:
        spotify_id = request.cookies.get("spotify_id")
    
    # Validation
    if not spotify_id:
        raise HTTPException(status_code=401, detail="Not authenticated (Missing ID)")
    
    # Get refresh token from database
    refresh_token = get_refresh_token(spotify_id)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token available")
    
    # Request new access token from Spotify
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    
    try:
        res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
        
        if res.status_code != 200:
            print(f"REFRESH ERROR: {res.text}")
            raise HTTPException(status_code=401, detail="Token refresh failed")
        
        tokens = res.json()
        new_access_token = tokens.get("access_token")
        new_refresh_token = tokens.get("refresh_token") # Spotify might rotate it
        expires_in = tokens.get("expires_in", 3600)
        
        if not new_access_token:
            raise HTTPException(status_code=401, detail="No access token in refresh response")
        
        # Calculate new expiry
        token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
        
        # Update Database:
        # If new_refresh_token is provided, save it. Otherwise keep the old one.
        # CRITICAL: We MUST update token_expires_at regardless.
        token_to_save = new_refresh_token if new_refresh_token else refresh_token
        save_refresh_token(spotify_id, token_to_save, token_expires_at)
        
        # Prepare JSON response
        response_data = {
            "access_token": new_access_token,
            "expires_in": expires_in
        }
        
        # Determine if running locally for cookie domain
        # CRITICAL: DO NOT set domain for localhost (breaks 127.0.0.1 vs localhost)
        original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        is_local = "127.0.0.1" in original_host or "localhost" in original_host
        
        # Web also sets cookie for redundancy
        response = JSONResponse(content=response_data)
        
        # Secure=True for production (HTTPS), False for local (HTTP)
        is_secure = not is_local
        
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=True,
            path="/",
            samesite="lax",
            max_age=expires_in,
            secure=is_secure  # Auto-detect HTTPS
        )
        
        # FIX: Restore spotify_id cookie if missing to prevent "Logged in as: None" loop
        response.set_cookie(
            key="spotify_id", 
            value=spotify_id, 
            httponly=True, 
            path="/", 
            samesite="lax", 
            max_age=2592000,  # 30 days
            secure=is_secure
        )

        return response
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"REFRESH EXCEPTION: {e}")
        raise HTTPException(status_code=500, detail="Token refresh failed")

@router.get("/api/currently-playing/{spotify_id}", tags=["Player"])
def get_currently_playing(spotify_id: str, request: Request):
    """
    Get currently playing track from Spotify.
    Uses stored refresh token to get fresh access token.
    """
    try:
        # Get refresh token from database
        refresh_token = get_refresh_token(spotify_id)
        if not refresh_token:
            return {"is_playing": False, "error": "No refresh token"}
        
        # Get fresh access token
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        
        token_res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
        if token_res.status_code != 200:
            return {"is_playing": False, "error": "Token refresh failed"}
        
        tokens = token_res.json()
        access_token = tokens.get("access_token")
        new_refresh = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        
        # Save new refresh token if rotated
        if new_refresh:
            token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
            save_refresh_token(spotify_id, new_refresh, token_expires_at)
        
        # Call Spotify currently playing endpoint
        spotify_headers = {"Authorization": f"Bearer {access_token}"}
        player_res = requests.get("https://api.spotify.com/v1/me/player/currently-playing", headers=spotify_headers)
        
        if player_res.status_code == 204:
            # No content - nothing playing
            return {"is_playing": False}
        
        if player_res.status_code != 200:
            return {"is_playing": False, "error": f"Spotify API error: {player_res.status_code}"}
        
        data = player_res.json()
        
        if not data.get("item"):
            # CHECK FOR ADVERTISEMENT
            if data.get("currently_playing_type") == "ad":
                # Spotify sometimes provides progress_ms for ads in the root object
                return {
                    "is_playing": True, 
                    "is_ad": True,
                    "track": {
                        "progress_ms": data.get("progress_ms", 0),
                        "duration_ms": 30000 # Default 30s for ads if not provided
                    }
                }
            return {"is_playing": False}
        
        track = data["item"]
        
        # Log currently playing track for debugging (Deduplicated)
        # Only log if the track has CHANGED for this user to avoid spam
        track_name = track.get("name", "Unknown")
        artist_names = ", ".join([a["name"] for a in track.get("artists", [])])
        current_log_string = f"{track_name} - {artist_names}"
        
        # Check against last logged track for this user
        if _last_logged_track.get(spotify_id) != current_log_string:
            print(f"[Playing] {current_log_string}")
            _last_logged_track[spotify_id] = current_log_string

        return {
            "is_playing": data.get("is_playing", False),
            "track": {
                "id": track.get("id"),
                "name": track.get("name"),
                "artists": [a["name"] for a in track.get("artists", [])],
                "album": track.get("album", {}).get("name"),
                "image": track.get("album", {}).get("images", [{}])[0].get("url") if track.get("album", {}).get("images") else None,
                "duration_ms": track.get("duration_ms"),
                "progress_ms": data.get("progress_ms", 0),
                "external_url": track.get("external_urls", {}).get("spotify")
            }
        }
        
    except Exception as e:
        print(f"CURRENTLY PLAYING ERROR: {e}")
        return {"is_playing": False, "error": str(e)}

@router.get("/api/profile/{spotify_id}", tags=["Profile"])
def get_user_profile(spotify_id: str, request: Request):
    """
    Lightweight endpoint to get user profile info only.
    Does NOT trigger emotion analysis - just returns cached user data.
    """
    try:
        # Try to get from Redis cache first
        cache_key = f"profile:{spotify_id}"
        cached = redis_client.get(cache_key) if redis_client else None
        
        if cached:
            return json.loads(cached)
        
        # Get refresh token to fetch from Spotify
        refresh_token = get_refresh_token(spotify_id)
        if not refresh_token:
            return {"error": "No refresh token", "user": None, "image": None}
        
        # Get fresh access token
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        
        token_res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
        if token_res.status_code != 200:
            return {"error": "Token refresh failed", "user": None, "image": None}
        
        tokens = token_res.json()
        access_token = tokens.get("access_token")
        
        # Fetch user profile from Spotify
        spotify_headers = {"Authorization": f"Bearer {access_token}"}
        user_res = requests.get("https://api.spotify.com/v1/me", headers=spotify_headers)
        
        if user_res.status_code != 200:
            return {"error": "Failed to fetch profile", "user": None, "image": None}
        
        user_data = user_res.json()
        display_name = user_data.get("display_name", spotify_id)
        user_image = user_data["images"][0]["url"] if user_data.get("images") else None
        
        result = {
            "user": display_name,
            "image": user_image,
            "spotify_id": spotify_id
        }
        
        # Cache for 5 minutes
        if redis_client:
            redis_client.setex(cache_key, 300, json.dumps(result))
        
        return result
        
    except Exception as e:
        print(f"PROFILE ERROR: {e}")
        return {"error": str(e), "user": None, "image": None}

@router.post("/analyze-sentiment-background", tags=["Background"])
async def analyze_sentiment_background(
    background_tasks: BackgroundTasks,
    spotify_id: str = Body(..., embed=True, description="Spotify ID"),
    time_range: str = Body("short_term", embed=True, description="Time range"),
    extended: bool = Body(False, embed=True, description="Use extended track list (20 tracks)")
):
    """
    Easter Egg trigger: Upgrades sentiment report to Top 20 tracks.
    Now runs asynchronously to prevent HTTP timeouts.
    """
    try:
        # Detect provider from spotify_id prefix
        provider = "spotify"
        user_id = spotify_id
        if ":" in spotify_id:
            provider = spotify_id.split(":")[0]
            user_id = spotify_id.split(":")[1]
            
        # Initial Cache Update & Instant Reload Logic
        cached_data = get_cached_top_data("top", spotify_id, time_range)
        if cached_data:
            # INSTANT RELOAD: If we already have a 20-track result, use it immediately
            if extended and cached_data.get('extended_sentiment_report'):
                print(f"EASTER EGG: Instant reload from cache for {spotify_id}")
                cached_data['sentiment_report'] = cached_data['extended_sentiment_report']
                cached_data['sentiment_scores'] = cached_data.get('extended_sentiment_scores', [])
                cache_top_data("top", spotify_id, time_range, cached_data)
                return {
                    "status": "Analysis loaded from cache", 
                    "extended": True,
                    "sentiment_report": cached_data['extended_sentiment_report']
                }

            # Force "Syncing" state to prevent "Unavailable" UI
            # We write to extended_sentiment_report so sentiment_report (Top 10) stays intact.
            cached_data['extended_sentiment_report'] = "Syncing (11/20): Initializing..."
            cache_top_data("top", spotify_id, time_range, cached_data)

        if provider == "lastfm":
            from app.lastfm_handler import process_lastfm_sentiment_background
            # Pass original FULL ID (e.g. lastfm:anggarnts) for cache consistency
            
            # Use QStash in production, BackgroundTasks in local
            from app.qstash_handler import publish_to_qstash
            did_push = publish_to_qstash("/api/tasks/analyze-sentiment", {
                "spotify_id": spotify_id,
                "time_range": time_range,
                "extended": extended,
                "provider": "lastfm"
            })
            if not did_push:
                background_tasks.add_task(process_lastfm_sentiment_background, spotify_id, time_range, extended)
        else:
            from app.spotify_handler import process_sentiment_background
            # Use QStash in production, BackgroundTasks in local
            from app.qstash_handler import publish_to_qstash
            did_push = publish_to_qstash("/api/tasks/analyze-sentiment", {
                "spotify_id": spotify_id,
                "time_range": time_range,
                "extended": extended,
                "provider": "spotify"
            })
            if not did_push:
                background_tasks.add_task(process_sentiment_background, spotify_id, time_range, cached_data, extended)

        return {"status": "Analysis triggered", "extended": extended, "method": "QStash" if "localhost" not in os.getenv("APP_URL", "") else "Local"}
        
    except Exception as e:
        print(f"EASTER EGG ERROR: {e}")
        return {"error": str(e)}

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
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"], description="Time range"),
    spotify_id: Optional[str] = Query(None, description="Spotify ID for server-side refresh fallback"),
    extended: bool = Query(False, description="Use extended tracks (Top 20) for analysis")
):
    try:
        return sync_user_data(access_token, time_range, extended=extended)
    except HTTPException as he:
        if he.status_code == 401 and spotify_id:
            print(f"SYNC TOKEN EXPIRED for {spotify_id}. Attempting server-side refresh...")
            refresh_token = get_refresh_token(spotify_id)
            if refresh_token:
                try:
                    # Request new access token
                    client_id = os.getenv("SPOTIFY_CLIENT_ID")
                    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
                    
                    payload = {
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                        "client_id": client_id,
                        "client_secret": client_secret
                    }
                    headers = {"Content-Type": "application/x-www-form-urlencoded"}
                    
                    res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
                    if res.status_code == 200:
                        tokens = res.json()
                        new_access_token = tokens.get("access_token")
                        new_refresh_token = tokens.get("refresh_token")
                        expires_in = tokens.get("expires_in", 3600)
                        
                        # Save new refresh token if rotated
                        token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
                        token_to_save = new_refresh_token if new_refresh_token else refresh_token
                        save_refresh_token(spotify_id, token_to_save, token_expires_at)
                        
                        print("SYNC REFRESH SUCCESS. Retrying sync with new token...")
                        # Retry sync with NEW token
                        return sync_user_data(new_access_token, time_range)
                    else:
                        print(f"SYNC REFRESH ERROR: {res.text}")
                except Exception as refresh_err:
                    print(f"SYNC REFRESH EXCEPTION: {refresh_err}")
            else:
                 print("SYNC REFRESH FAILED: No refresh token in DB.")
        
        # If we couldn't refresh or it wasn't a 401, re-raise
        raise he
        
    except Exception as e:
        print(f"SYNC WRAPPER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Sync failed.")

@router.get("/top-data", tags=["Query"])
def get_top_data(
    profile_id: str = Query(..., description="Profile ID (Spotify/Last.fm)"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"]),
    limit: int = Query(10, ge=1),
    sort: str = Query("popularity")
):
    data = get_cached_top_data("top", profile_id, time_range)
    if not data:
        return {"message": "No cached data found."}

    def sort_items(items):
        return sorted(items, key=lambda x: x.get(sort, 0), reverse=True)[:limit]

    data["artists"] = sort_items(data.get("artists", []))
    data["tracks"] = sort_items(data.get("tracks", []))
    return data

@router.get("/top-genres", tags=["Query"])
def top_genres(
    profile_id: str = Query(..., description="Profile ID (Spotify/Last.fm)"),
    time_range: str = Query("medium_term", enum=["short_term", "medium_term", "long_term"])
):
    data = get_cached_top_data("top", profile_id, time_range)
    if not data:
        return {"error": "No cached data found for this user/time_range"}

    genre_count = {}
    for artist in data.get("artists", []):
        for genre in artist.get("genres", []):
            genre_count[genre] = genre_count.get(genre, 0) + 1

    sorted_genres = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)
    return {"genres": [{"name": name, "count": count} for name, count in sorted_genres]}

@router.get("/history", tags=["Query"])
def get_sync_history(profile_id: str = Query(..., description="Profile ID (Spotify/Last.fm)")):
    return get_user_history(profile_id)


@router.get("/api/dashboard/{profile_id}", tags=["Dashboard API"])
def get_dashboard_data(
    profile_id: str, 
    background_tasks: BackgroundTasks, 
    time_range: str = "short_term", 
    force_sync: bool = False,
    extended: bool = Query(False),
    request: Request = None, 
    response: Response = None
):
    """JSON API endpoint for Next.js dashboard"""
    try:
        # DEBUG: Log dashboard request
        print(f"WEB DASHBOARD: Fetching data for {profile_id} [Time range: {time_range}] (Force Sync: {force_sync})")
        
        # Check for access_token cookie to perform REALTIME SYNC
        access_token = request.cookies.get("access_token")
        logged_in_id = request.cookies.get("spotify_id")
        
        # Determine if we are viewing our own profile or someone else's
        is_own_profile = (logged_in_id == profile_id)

        # ROBUST AUTH: If cookie is missing, check Authorization header?
        # This handles cases where browser drops cookies (e.g. SameSite localhost issues)
        if not is_own_profile and not profile_id.startswith("lastfm:"):
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token_from_header = auth_header.split(" ")[1]
                print(f"WEB DASHBOARD: Cookie missing but found Bearer token. Verifying identity...")
                
                # Check identity via Spotify
                try:
                    user_res = requests.get("https://api.spotify.com/v1/me", headers={"Authorization": f"Bearer {token_from_header}"})
                    if user_res.status_code == 200:
                        user_data = user_res.json()
                        verified_id = user_data.get("id")
                        
                        if verified_id == profile_id:
                            print(f"WEB DASHBOARD: Identity Verified via Token! Restoring session for {verified_id}")
                            is_own_profile = True
                            access_token = token_from_header # Use this token for sync
                            logged_in_id = verified_id
                            
                            # CRITICAL: Restore cookies in response to fix browser state
                            original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
                            is_local = "127.0.0.1" in original_host or "localhost" in original_host
                            is_secure = not is_local

                            response.set_cookie(key="spotify_id", value=verified_id, httponly=True, path="/", samesite="lax", max_age=2592000, secure=is_secure)
                            response.set_cookie(key="access_token", value=access_token, httponly=True, path="/", samesite="lax", max_age=3600, secure=is_secure)
                        else:
                            print(f"WEB DASHBOARD: Token belongs to {verified_id}, not {profile_id}. Public View.")
                except Exception as e:
                    print(f"WEB DASHBOARD: Token verification failed: {e}")

        # STRICT PRIVACY ENFORCEMENT
        # The user requested that public viewing is entirely disabled.
        # If they are logged out or viewing someone else's dashboard, immediately reject.
        if not is_own_profile:
            print(f"WEB DASHBOARD: Access denied for {profile_id}. User is not authenticated.")
            raise HTTPException(status_code=401, detail="Unauthorized. Please login again.")

        # LAST.FM HANDLING: If it's a Last.fm ID, use the Last.fm handler directly
        if profile_id.startswith("lastfm:"):
            username = profile_id.replace("lastfm:", "")
            
            data = None
            if force_sync:
                print(f"WEB DASHBOARD: force_sync=True for Last.fm user {username}. Bypassing cache.")
            else:
                data = get_cached_top_data("top", profile_id, time_range)
            
            if data:
                # Live fetch user info to keep profile picture instantly synced
                try:
                    from app.lastfm_handler import get_user_info
                    live_user = get_user_info(username)
                    if live_user:
                        li_name = live_user.get("realname") or live_user.get("name", username)
                        li_img = ""
                        for img in reversed(live_user.get("image", [])):
                            url = img.get("#text", "")
                            if url and url.strip():
                                li_img = url
                                break
                        if li_img:
                            data["image"] = li_img
                        data["user"] = li_name
                except Exception:
                    pass
                

            if not data:
                print(f"WEB DASHBOARD: No cache for {username}. Starting Last.fm sync (Force: {force_sync})...")
                data = sync_lastfm_user_data(username, time_range, background_tasks=background_tasks, extended=extended, force_sync=force_sync)
                if data:
                    print(f"WEB DASHBOARD: Sync triggered for {username}")
                else:
                    print(f"WEB DASHBOARD: Sync failed to start for {username}")
            
            if not data:
                print(f"WEB DASHBOARD ERROR: Sync failed for Last.fm user '{username}'")
                raise HTTPException(status_code=404, detail="Last.fm user data unavailable. Please verify your username exists and has enough scrobbles.")
            
            # Re-format genres for the response (similar to Spotify logic below)
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

            # Protect UI polling from race condition during Easter Egg
            if extended:
                if "extended_sentiment_report" in data and data["extended_sentiment_report"]:
                    data["sentiment_report"] = data["extended_sentiment_report"]
                    data["sentiment_scores"] = data.get("extended_sentiment_scores", [])
                else:
                    # If extended requested but no report/sync yet, we show this lock
                    data["sentiment_report"] = "Syncing (11/20): Digging deeper..."
            else:
                # If NOT extended, we strictly use the Top 10 report.
                # If they just came from an extended sync, the worker might have
                # updated sentiment_report? We'll fix that in the workers next.
                pass

            return {
                "user": data["user"],
                "image": data.get("image"),
                "time_range": time_range,
                "sentiment_report": data.get("sentiment_report", ""),
                "sentiment_scores": data.get("sentiment_scores", []),
                "artists": data.get("artists", []),
                "tracks": data.get("tracks", []),
                "genres": genre_list,
                "genre_artists_map": genre_artists_map,
                "source": "lastfm"
            }

        if is_own_profile:
            # 1. AUTO-REFRESH LOGIC ...
            pass # Logic continues below
            
        # (Robust Auth logic was moved above to enforce strict privacy)

        if is_own_profile:
            # 1. AUTO-REFRESH LOGIC (Server-Side) - ONLY FOR OWN PROFILE
            # If no access_token cookie, try to refresh using DB refresh_token
            if not access_token:
                print(f"WEB DASHBOARD: No access_token cookie. Attempting server-side refresh for {profile_id}...")
                refresh_token = get_refresh_token(profile_id)
                
                if refresh_token:
                    try:
                         # Request new access token from Spotify
                        client_id = os.getenv("SPOTIFY_CLIENT_ID")
                        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
                        
                        payload = {
                            "grant_type": "refresh_token",
                            "refresh_token": refresh_token,
                            "client_id": client_id,
                            "client_secret": client_secret
                        }
                        headers = {"Content-Type": "application/x-www-form-urlencoded"}
                        
                        res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
                        if res.status_code == 200:
                            tokens = res.json()
                            access_token = tokens.get("access_token")
                            new_refresh_token = tokens.get("refresh_token")
                            expires_in = tokens.get("expires_in", 3600)
                            
                            # Save new refresh token if rotated
                            token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
                            token_to_save = new_refresh_token if new_refresh_token else refresh_token
                            save_refresh_token(profile_id, token_to_save, token_expires_at)
                            
                            # Set cookie for future requests
                            # Determine if running locally (copied from other endpoints logic)
                            # In FastAPI dependency injection, request.url.hostname could also work, 
                            # but sticking to existing pattern for consistency
                            original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
                            is_local = "127.0.0.1" in original_host or "localhost" in original_host
                            is_secure = not is_local

                            response.set_cookie(
                                key="access_token",
                                value=access_token,
                                httponly=True,
                                path="/",
                                samesite="lax",
                                max_age=expires_in,
                                secure=is_secure
                            )
                            print("WEB DASHBOARD: Server-side refresh success! Cookie set.")
                        else:
                            print(f"WEB DASHBOARD: Server-side refresh failed ({res.text})")
                    except Exception as e:
                        print(f"WEB DASHBOARD: Server-side refresh error: {e}")

            # 2. CACHE-FIRST LOGIC - ONLY FOR OWN PROFILE
            if access_token:
                # 2.1 Check cache first
                data = get_cached_top_data("top", profile_id, time_range)
                
                # 2.2 Freshness Check (Optional: Only sync if no cache or cache is old)
                # For now, if cache exists, we return it. 
                # frontend-side will handle manual refresh if needed.
                if data:
                    # Check if analysis is indeed done, or if it's still "getting ready"
                    sentiment_report = data.get("sentiment_report", "")
                    if "getting ready" in sentiment_report or "being analyzed" in sentiment_report:
                        print(f"WEB DASHBOARD: Vibe still loading for {profile_id}. Triggering background refresh.")
                        # Import here to avoid circular dependencies
                        from app.spotify_handler import process_sentiment_background
                        background_tasks.add_task(process_sentiment_background, profile_id, time_range, data, False)
                    
                    print(f"WEB DASHBOARD: Returning cached data for {profile_id}.")
                else:
                    # 2.3 No cache -> Sync fresh data
                    print(f"WEB DASHBOARD: No cache found. Syncing fresh data for {profile_id}...")
                    try:
                        data = sync_user_data(access_token, time_range, background_tasks=background_tasks)
                        print("WEB DASHBOARD: Sync success!")
                    except Exception as e:
                        print(f"WEB DASHBOARD: Sync failed ({e}). Falling back to empty.")
        # If we reach here, it's a Spotify profile and is_own_profile must be True due to the 401 check above.
        # 1. AUTO-REFRESH LOGIC (Server-Side) - ONLY FOR OWN PROFILE
        # If no access_token cookie, try to refresh using DB refresh_token
        if not access_token:
            print(f"WEB DASHBOARD: No access_token cookie. Attempting server-side refresh for {profile_id}...")
            refresh_token = get_refresh_token(profile_id)
            
            if refresh_token:
                try:
                        # Request new access token from Spotify
                    client_id = os.getenv("SPOTIFY_CLIENT_ID")
                    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
                    
                    payload = {
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                        "client_id": client_id,
                        "client_secret": client_secret
                    }
                    headers = {"Content-Type": "application/x-www-form-urlencoded"}
                    
                    res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)
                    if res.status_code == 200:
                        tokens = res.json()
                        access_token = tokens.get("access_token")
                        new_refresh_token = tokens.get("refresh_token")
                        expires_in = tokens.get("expires_in", 3600)
                        
                        # Save new refresh token if rotated
                        token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
                        token_to_save = new_refresh_token if new_refresh_token else refresh_token
                        save_refresh_token(profile_id, token_to_save, token_expires_at)
                        
                        # Set cookie for future requests
                        # Determine if running locally (copied from other endpoints logic)
                        # In FastAPI dependency injection, request.url.hostname could also work, 
                        # but sticking to existing pattern for consistency
                        original_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
                        is_local = "127.0.0.1" in original_host or "localhost" in original_host
                        is_secure = not is_local

                        response.set_cookie(
                            key="access_token",
                            value=access_token,
                            httponly=True,
                            path="/",
                            samesite="lax",
                            max_age=expires_in,
                            secure=is_secure
                        )
                        print("WEB DASHBOARD: Server-side refresh success! Cookie set.")
                    else:
                        print(f"WEB DASHBOARD: Server-side refresh failed ({res.text})")
                except Exception as e:
                    print(f"WEB DASHBOARD: Server-side refresh error: {e}")

        # 2. CACHING & SYNC LOGIC
        if access_token:
            # 2.1 Check cache first (unless force_sync is handled)
            data = None
            if not force_sync:
                data = get_cached_top_data("top", profile_id, time_range)
            
            # 2.2 Freshness Check (Optional: Only sync if no cache or cache is old)
            # For now, if cache exists, we return it. 
            # frontend-side will handle manual refresh if needed.
            if data:
                # Check if analysis is indeed done, or if it's still loading
                # We check the CORRECT report and the CORRECT track count for the current mode.
                target_report = data.get("extended_sentiment_report" if extended else "sentiment_report", "")
                target_count = data.get("extended_sentiment_count" if extended else "sentiment_count", 0)
                expected_count = 20 if extended else 10
                
                loading_keywords = ["getting ready", "being analyzed", "Syncing", "Initializing", "Analyzing lyrics", "enhancement in progress", "Digging deeper"]
                is_status_loading = any(kw in target_report for kw in loading_keywords)
                
                # It's loading if the status says so, OR if the report is missing, OR if the count is wrong
                is_loading = is_status_loading or not target_report or target_count != expected_count
                
                if is_loading:
                    print(f"WEB DASHBOARD: Vibe still loading for {profile_id}. Triggering background refresh.")
                    provider = data.get("source", "spotify") 
                    
                    if provider == "lastfm":
                        from app.lastfm_handler import process_lastfm_sentiment_background
                        # Legacy function name fallback replaced by combined worker
                        from app.lastfm_handler import process_lastfm_enhancement_background
                        background_tasks.add_task(process_lastfm_enhancement_background, profile_id.replace("lastfm:", ""), time_range, data, extended)
                    else:
                        from app.spotify_handler import process_sentiment_background
                        background_tasks.add_task(process_sentiment_background, profile_id, time_range, data, extended)
                
                print(f"WEB DASHBOARD: Returning cached data for {profile_id}.")
            else:
                # 2.3 No cache -> Sync fresh data
                print(f"WEB DASHBOARD: No cache found. Syncing fresh data for {profile_id}...")
                try:
                    data = sync_user_data(access_token, time_range, background_tasks=background_tasks)
                    print("WEB DASHBOARD: Sync success!")
                except Exception as e:
                    print(f"WEB DASHBOARD: Sync failed ({e}). Falling back to empty.")
                    data = None
        else:
            print(f"WEB DASHBOARD: No access_token. Reading from cache for {profile_id}.")
            data = get_cached_top_data("top", profile_id, time_range)
        # PUBLIC VIEW / OTHER PROFILE        # Public caching fallback is disabled because we now enforce strict privacy
        # The user requested that the dashboard cannot be opened after logout.
        # This code is now unreachable due to the 401 check above, but left for context:
        if not is_own_profile:
            pass

        if data and extended:
            if "extended_sentiment_report" in data and data["extended_sentiment_report"]:
                data["sentiment_report"] = data["extended_sentiment_report"]
                data["sentiment_scores"] = data.get("extended_sentiment_scores", [])
            else:
                data["sentiment_report"] = "Syncing (11/20): Digging deeper..."
        elif data and not extended:
            # If standard mode requested, but the worker is currently a Top 20 worker
            # which might be updating sentiment_report erroneously? 
            # (We'll fix the worker to stop doing that, but this is a double-check)
            if "extended_sentiment_report" in data and data["sentiment_report"] == data["extended_sentiment_report"]:
                # This means they are identical, which shouldn't happen after our fix.
                pass

        if not data:
            raise HTTPException(status_code=404, detail="No data found. Please login again.")

        sentiment_report = data.get("sentiment_report", "Sentiment analysis is getting ready...")
        sentiment_scores = data.get("sentiment_scores")
        
        if sentiment_scores is None:
            sentiment_scores = []

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
            "image": data.get("image"),
            "time_range": time_range,
            "sentiment_report": sentiment_report,
            "sentiment_scores": sentiment_scores,
            "artists": data.get("artists", []),
            "tracks": data.get("tracks", []),
            "genres": genre_list,
            "genre_artists_map": genre_artists_map
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"DASHBOARD API CRASH: {e}")
        print(f"TRACEBACK:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Internal Dashboard Error: {str(e)}")

@router.get("/about", response_class=HTMLResponse, tags=["Pages"])
def about_page(request: Request): 
    spotify_id = request.cookies.get("spotify_id")
    return templates.TemplateResponse("about.html", {
        "request": request,
        "spotify_id": spotify_id
    })

@router.get("/admin/stats", tags=["Admin"])
def get_stats():
    report = get_system_wide_stats()
    return PlainTextResponse(content=report)

@router.get("/admin/clear", tags=["Admin"])
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

@router.get("/admin/report/{profile_id}", tags=["Admin"])
def get_user_stats(profile_id: str):
    try:
        details = get_user_report(profile_id)
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

@router.get("/admin/sync", tags=["Admin"])
def trigger_db_sync():
    try:
        from app.db_handler import sync_neon_supabase
        sync_meta = sync_neon_supabase()
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        RECEIPT_WIDTH = 40

        receipt_lines = []
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append("      DATABASE SYNC COMPLETED     ")
        receipt_lines.append("*" * RECEIPT_WIDTH)
        receipt_lines.append(f" DATE: {now}")
        receipt_lines.append("=" * RECEIPT_WIDTH)
        receipt_lines.append("\n  STATUS: SUCCESS\n")
        receipt_lines.append(f" PUSHED TO BACKUP: {sync_meta.get('pushed_to_backup', 0)}")
        receipt_lines.append(f" PULLED FROM BACKUP: {sync_meta.get('pulled_from_backup', 0)}")
        
        if sync_meta.get("errors"):
            receipt_lines.append("\n  ERRORS ENCOUNTERED:")
            for err in sync_meta["errors"]:
                receipt_lines.append(f"  - {err}")
        
        receipt_lines.append("\n\n" + "=" * RECEIPT_WIDTH)
        receipt_lines.append("       DATA NOW CONSOLIDATED      ")
        receipt_lines.append("=" * RECEIPT_WIDTH)

        report_string = "\n".join(receipt_lines)
        return Response(content=report_string, media_type="text/plain")

    except Exception as e:
        print(f"ADMIN_SYNC: FAILED: {e}")
        return Response(
            content=f"FAILED TO SYNC DATABASE: {str(e)}", 
            media_type="text/plain", 
            status_code=500
        )

@router.get("/admin/export", tags=["Admin"])
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

async def run_analysis_logic(profile_id: str):
    print(f"[START] Processing analysis for: {profile_id}")
    await asyncio.sleep(2)
    print(f"[FINISH] Analysis complete for: {profile_id}")

@router.post("/start-background-analysis")
async def start_background_analysis(
    profile_id: str, 
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
                data=json.dumps({"profile_id": profile_id})
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
    profile_id = data.get("profile_id") or data.get("spotify_id")
    await run_analysis_logic(profile_id)
    return {"status": "Processed"}

@router.post("/api/tasks/process-sentiment")
async def process_sentiment_task(request: Request):
    """
    QStash Worker for heavy lyrics-based sentiment analysis.
    Verifies signature and dispatches to the correct handler.
    """
    from app.qstash_handler import get_qstash_receiver
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
        print(f"QSTASH WORKER: INVALID SIGNATURE: {e}")
        raise HTTPException(status_code=401, detail="Invalid signature")
        
    data = await request.json()
    spotify_id = data.get("spotify_id")
    time_range = data.get("time_range", "medium_term")
    extended = data.get("extended", False)
    provider = data.get("provider", "spotify")
    
    print(f"QSTASH WORKER: Starting sentiment for {spotify_id} ({provider})")
    
    if provider == "lastfm":
        from app.lastfm_handler import process_lastfm_sentiment_background
        process_lastfm_sentiment_background(spotify_id, time_range, extended=extended)
    else:
        from app.spotify_handler import process_sentiment_background
        # Spotify handler expects a 'result' dict but we refactored it to refresh from cache
        process_sentiment_background(spotify_id, time_range, {}, extended=extended)
        
    return {"status": "Sentiment processed"}

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

@router.post("/api/tasks/lastfm-enhancement")
async def lastfm_enhancement_task(request: Request):
    """
    QStash Worker Endpoint: Handles image/genre enhancement for Last.fm.
    """
    receiver = get_qstash_receiver()
    signature = request.headers.get("Upstash-Signature")
    body_bytes = await request.body()
    
    app_url = os.getenv("APP_URL", "")
    if "localhost" not in app_url and "127.0.0.1" not in app_url:
        try:
            receiver.verify(
                body=body_bytes.decode("utf-8"),
                signature=signature,
                url=str(request.url)
            )
        except Exception as e:
            return {"status": "Forbidden", "error": str(e)}

    data = await request.json()
    username = data.get("username")
    time_range = data.get("time_range", "medium_term")
    extended = data.get("extended", False)
    result = data.get("result")
    force_sync = data.get("force_sync", False)

    print(f"QSTASH WORKER: Starting Last.fm Enhancement for {username} (Force: {force_sync})")

    try:
        from app.lastfm_handler import process_lastfm_enhancement_background
        process_lastfm_enhancement_background(username, time_range, result, extended, force_sync)
        return {"status": "Enhancement Complete"}
    except Exception as e:
        print(f"QSTASH WORKER ERROR (LFM): {e}")
        return {"status": "Failed", "error": str(e)}

@router.post("/api/tasks/analyze-sentiment")
async def analyze_sentiment_task(request: Request):
    """
    QStash Worker Endpoint: Handles heavy sentiment analysis for Spotify/Last.fm.
    """
    receiver = get_qstash_receiver()
    signature = request.headers.get("Upstash-Signature")
    body_bytes = await request.body()
    
    # Verify signature in production
    app_url = os.getenv("APP_URL", "")
    if "localhost" not in app_url and "127.0.0.1" not in app_url:
        try:
            receiver.verify(
                body=body_bytes.decode("utf-8"),
                signature=signature,
                url=str(request.url)
            )
        except Exception as e:
            print(f"QSTASH VERIFY ERROR: {e}")
            return {"status": "Forbidden", "error": str(e)}

    data = await request.json()
    spotify_id = data.get("spotify_id")
    time_range = data.get("time_range", "short_term")
    extended = data.get("extended", False)
    provider = data.get("provider", "spotify")

    print(f"QSTASH WORKER: Starting Sentiment Analysis for {spotify_id} (Provider: {provider}, Extended: {extended})")

    try:
        if provider == "lastfm":
            from app.lastfm_handler import process_lastfm_sentiment_background
            process_lastfm_sentiment_background(spotify_id, time_range, extended=extended)
        else:
            from app.spotify_handler import process_sentiment_background
            # For Spotify, we need to fetch cached_data first
            from app.cache_handler import get_cached_top_data
            cached_data = get_cached_top_data("top", spotify_id, time_range)
            if cached_data:
                process_sentiment_background(spotify_id, time_range, cached_data, extended=extended)
            else:
                print(f"QSTASH ERROR: No cached data for {spotify_id}")
        
        return {"status": "Analysis Complete"}
    except Exception as e:
        print(f"QSTASH WORKER ERROR: {e}")
        return {"status": "Failed", "error": str(e)}

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
def get_recently_played(
    request: Request, 
    limit: int = 50,
    spotify_id: Optional[str] = Query(None, description="Spotify ID for fallback refresh")
):
    # Extract Access Token from Header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    access_token = auth_header.split(" ")[1]

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"https://api.spotify.com/v1/me/player/recently-played?limit={limit}"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 401 and spotify_id:
             print(f"HISTORY 401 for {spotify_id}. RETRYING WITH REFRESH.")
             # REFRESH LOGIC
             refresh_token = get_refresh_token(spotify_id)
             if refresh_token:
                 client_id = os.getenv("SPOTIFY_CLIENT_ID")
                 client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
                 payload = {
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret
                 }
                 res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
                 if res.status_code == 200:
                     tokens = res.json()
                     new_access = tokens.get("access_token")
                     new_refresh = tokens.get("refresh_token")
                     expires_in = tokens.get("expires_in", 3600)
                     
                     token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
                     save_refresh_token(spotify_id, new_refresh if new_refresh else refresh_token, token_expires_at)
                     
                     # RETRY
                     headers["Authorization"] = f"Bearer {new_access}"
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
            image_url = images[0]["url"] if images else "" # Use largest image for better quality
            
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
def get_user_profile_detail(
    request: Request,
    spotify_id: Optional[str] = Query(None, description="Spotify ID for fallback refresh")
):
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
        
        # REFRESH LOGIC
        if response.status_code == 401 and spotify_id:
             print(f"PROFILE 401 for {spotify_id}. RETRYING WITH REFRESH.")
             refresh_token = get_refresh_token(spotify_id)
             if refresh_token:
                 client_id = os.getenv("SPOTIFY_CLIENT_ID")
                 client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
                 payload = {
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret
                 }
                 res = requests.post("https://accounts.spotify.com/api/token", data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
                 if res.status_code == 200:
                     tokens = res.json()
                     new_access = tokens.get("access_token")
                     new_refresh = tokens.get("refresh_token")
                     expires_in = tokens.get("expires_in", 3600)
                     
                     token_expires_at = datetime.datetime.now(timezone.utc) + datetime.timedelta(seconds=expires_in)
                     save_refresh_token(spotify_id, new_refresh if new_refresh else refresh_token, token_expires_at)
                     
                     # RETRY
                     headers["Authorization"] = f"Bearer {new_access}"
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
        import traceback
        print(f"CRITICAL ERROR in dashboard_api: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")

# ========== SYSTEM SETTINGS ==========

@router.get("/api/active-provider", tags=["Settings"])
def api_get_active_provider():
    """Get system-wide active provider (spotify or lastfm)"""
    try:
        provider = get_active_provider()
        return {"provider": provider}
    except Exception as e:
        print(f"ERROR Fetching Provider: {e}")
        return {"provider": "spotify"}

@router.post("/api/active-provider", tags=["Settings"])
def api_set_active_provider(data: dict = Body(...)):
    """Set system-wide active provider"""
    provider = data.get("provider")
    if provider not in ["spotify", "lastfm"]:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    try:
        set_active_provider(provider)
        log_system("ADMIN", f"System provider changed to: {provider}", "ADMIN_CENTER")
        return {"status": "ok", "provider": provider}
    except Exception as e:
        print(f"ERROR Setting Provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))
