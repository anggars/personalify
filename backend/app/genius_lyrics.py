import os
import requests
import re
import time
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": "CompuServe Classic/1.22"
    }

def clean_lyrics(text):
    # Remove multiline bracketed text like [Chorus \n Singer]
    text = re.sub(r"\[[\s\S]*?\]", "", text)
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        s = line.strip()
        if not s: continue
        if re.match(r"^\d+\s+contributors?$", s.lower()): continue
        blocked = [
            "translation", "translated", "lyrics",
            "click", "contribute", "read more",
            "produced by", "written by"
        ]
        if any(b in s.lower() for b in blocked): continue
        cleaned.append(s)
    return "\n".join(cleaned)

def get_page_html(url):
    translate_url = f"https://translate.google.com/translate?sl=auto&tl=en&u={url}&client=webapp"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    # Reduce retries and timeout for Vercel Serverless (max 60s total execution)
    # Shorter timeout (1.5s) to prevent dashboard hanging
    try:
        print(f"ATTEMPTING GOOGLE TRANSLATE PROXY: {url}")
        r = requests.get(translate_url, headers=headers, timeout=5.0)
        
        if r.status_code == 200:
            return r.text
        else:
            print(f"GOOGLE TRANSLATE BLOCKED ({r.status_code}).")
            
    except Exception as e:
        print(f"GOOGLE TRANSLATE ERROR: {e}")

    return None

def search_artist_id(query):
    try:
        res = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": query},
            headers=get_headers(),
            timeout=3
        )
        if res.status_code != 200: return []
        hits = res.json()["response"]["hits"]
        artists = []
        seen = set()
        for hit in hits:
            if hit["type"] == "song":
                a = hit["result"]["primary_artist"]
                if a["id"] not in seen:
                    artists.append({"id": a["id"], "name": a["name"], "image": a["image_url"]})
                    seen.add(a["id"])
        return artists
    except: return []

def get_suggestions(query):
    try:
        res = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": query},
            headers=get_headers(),
            timeout=5
        )
        if res.status_code != 200: return []
        hits = res.json()["response"]["hits"]
        suggestions = {}
        for hit in hits:
            if hit["type"] == "song":
                artist = hit["result"]["primary_artist"]
                artist_id = artist["id"]
                if artist_id not in suggestions:
                    suggestions[artist_id] = {
                        "id": artist_id,
                        "name": artist["name"],
                        "image_url": artist["image_url"]
                    }
        return list(suggestions.values())[:8]
    except Exception as e:
        print(f"Suggestion Error: {e}")
        return []

def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    try:
        while True:
            print(f"FETCHING SONGS PAGE {page}...")
            res = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={"sort": "release_date", "per_page": 50, "page": page},
                headers=get_headers(),
                timeout=20
            )
            if res.status_code != 200: break
            data = res.json()["response"]
            items = data["songs"]
            if not items: break
            for s in items:
                alb = s.get("primary_album")
                songs.append({
                    "id": s["id"],
                    "title": s["title"],
                    "image": s["song_art_image_thumbnail_url"],
                    "album": alb["name"] if alb else None,
                    "date": s.get("release_date_for_display")
                })
            if not data.get("next_page"): break
            page = data["next_page"]
        print(f"TOTAL SONGS FETCHED: {len(songs)}")
        return songs
    except: return songs

def get_lyrics_by_id(song_id):
    try:
        res = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=get_headers(),
            timeout=5
        )
        if res.status_code != 200:
            print(f"METADATA FETCH FAILED: {res.status_code}")
            return None

        song = res.json()["response"]["song"]
        title = song["title"]
        artist = song["primary_artist"]["name"]
        song_url = song["url"]

        html = get_page_html(song_url)

        if not html:
            print("FAILED TO RETRIEVE LYRICS HTML.")
            return None

        soup = BeautifulSoup(html, "html.parser")
        
        containers = soup.select("div[data-lyrics-container]")
        all_lines = []
        
        for c in containers:
            if "translation" in c.get_text().lower(): continue
            for br in c.find_all("br"): br.replace_with("\n")
            block = c.get_text("\n").strip()
            if block: 
                lines = block.split("\n")
                for line in lines:
                    stripped = line.strip()
                    if stripped: all_lines.append(stripped)
                    else: all_lines.append("") 

        lyrics_raw = "\n".join(all_lines)
        
        if not lyrics_raw.strip():
            old = soup.find("div", class_="lyrics")
            if old: lyrics_raw = old.get_text("\n")

        if not lyrics_raw.strip():
            print("PARSING ERROR: LYRICS CONTENT EMPTY.")
            return None

        return {
            "lyrics": clean_lyrics(lyrics_raw),
            "title": title,
            "artist": artist,
            "url": song_url
        }

    except Exception as e:
        print(f"GENIUS SCRAPER CRASH: {e}")
        return None

import urllib.parse

def fetch_lrclib_lyrics(track_name, artist_name):
    """Fetch lyrics using the free and open LRCLib API (No scraping needed)"""
    try:
        # LRCLib is highly optimized for "Track Name - Artist Name" matching
        t_clean = track_name.split(" - ")[0].split(" (")[0].strip()
        url = f"https://lrclib.net/api/get?artist_name={urllib.parse.quote(artist_name)}&track_name={urllib.parse.quote(t_clean)}"
        res = requests.get(url, timeout=3) # Shorter timeout
        if res.status_code == 200:
            data = res.json()
            if data and data.get("plainLyrics"):
                print(f"LRCLIB: Success for '{t_clean}' by '{artist_name}'")
                return data["plainLyrics"]
    except Exception as e:
        print(f"LRCLIB ERROR: {e}")
    return None

def search_google_lyrics(track_name, artist_name):
    """
    Emergency Fallback: Search Google for lyrics snippets if other sources fail.
    Uses basic scraping (best effort).
    """
    try:
        query = f"{track_name} {artist_name} lyrics"
        url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        print(f"GOOGLE SEARCH FALLBACK: Searching for '{query}'")
        res = requests.get(url, headers=headers, timeout=2)
        
        if res.status_code == 200:
            # Look for lyrics in Google's structured snippets or common sites
            soup = BeautifulSoup(res.text, "html.parser")
            
            # 1. Look for Google's own "Lyrics" card (class often contains 'ujudcb' or similar, but unstable)
            # We try to find any large text blocks that look like lyrics
            # Actually, most reliable is to look for common lyrics sites in the results 
            # and maybe scrape a snippet if available. 
            # But the user said "nemu paling atas yg disediain google".
            # Usually that's a div with a specific data attribute.
            
            lyrics_card = soup.find("div", {"data-lyricid": True})
            if lyrics_card:
                return lyrics_card.get_text("\n")
            
            # Fallback 2: Check for specific spans or divs that Google uses for lyrics
            # Note: This is highly variant. 
            container = soup.find("div", class_="PZPZ5b") # Common container for knowledge cards
            if container:
                return container.get_text("\n")
                
    except Exception as e:
        print(f"GOOGLE SEARCH ERROR: {e}")
    return None

def is_cjk(text):
    """Detect Chinese, Japanese, Korean characters."""
    return bool(re.search(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]', text))

def search_track_lyrics(track_name, artist_name):
    """
    Flow: LRCLib (Fast) -> Genius (Primary) -> Google (Last Resort)
    """
    # 1. Try LRCLib First
    lrclib_lyrics = fetch_lrclib_lyrics(track_name, artist_name)
    if lrclib_lyrics:
        return lrclib_lyrics

    # Fast Skip for CJK tracks if Genius is likely to fail/hang
    # Genius scraping via proxy often hangs on non-latin tracks
    is_asian = is_cjk(track_name) or is_cjk(artist_name)
    
    # 2. Fallback to Genius (Only if not Asian or after short attempt)
    print(f"GENIUS FALLBACK: Searching for '{track_name}' by '{artist_name}'")
    try:
        clean_track = track_name.split(" - ")[0].split(" (")[0].strip()
        # Add "lyrics" to query as requested for better accuracy
        query = f"{clean_track} {artist_name} lyrics"
        
        res = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": query},
            headers=get_headers(),
            timeout=2 # Fast timeout
        )
        if res.status_code == 200:
            hits = res.json().get("response", {}).get("hits", [])
            for hit in hits:
                if hit["type"] == "song":
                    result = hit["result"]
                    hit_artist = result.get("primary_artist", {}).get("name", "").lower()
                    if artist_name.lower() in hit_artist or hit_artist in artist_name.lower():
                        song_id = result["id"]
                        lyrics_data = get_lyrics_by_id(song_id)
                        if lyrics_data and lyrics_data.get("lyrics"):
                            return lyrics_data["lyrics"]
                        break # Stop if primary genius result failed
    except Exception as e:
        print(f"GENIUS TRACK SEARCH ERROR: {e}")

    # 3. Last Resort: Google Search (If not already skipped)
    google_lyrics = search_google_lyrics(track_name, artist_name)
    if google_lyrics:
        return clean_lyrics(google_lyrics)

    return None