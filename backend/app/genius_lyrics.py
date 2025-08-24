import os
import requests
import time
import random
from fastapi import HTTPException
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

# Session untuk maintain cookies
session = requests.Session()

def genius_headers():
    return {"Authorization": f"Bearer {GENIUS_TOKEN}"}

def get_random_user_agent():
    """Rotate user agents untuk avoid detection"""
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
    return random.choice(user_agents)

def scraping_headers():
    """Headers yang lebih realistic"""
    return {
        'User-Agent': get_random_user_agent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    }

def search_artist(q: str):
    resp = requests.get(
        f"{GENIUS_API_URL}/search",
        params={"q": q},
        headers=genius_headers()
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Gagal mencari artis")
    results = resp.json()["response"]["hits"]
    artists = []
    seen = set()
    for hit in results:
        artist = hit["result"]["primary_artist"]
        if artist["id"] not in seen:
            artists.append({"id": artist["id"], "name": artist["name"]})
            seen.add(artist["id"])
    return artists

def artist_songs(artist_id: int, max_pages: int = 10):
    songs = []
    page = 1
    while page <= max_pages:
        resp = requests.get(
            f"{GENIUS_API_URL}/artists/{artist_id}/songs",
            params={"per_page": 50, "page": page, "sort": "popularity"},
            headers=genius_headers()
        )
        if resp.status_code != 200:
            break
        data = resp.json()["response"]["songs"]
        if not data:
            break
        for song in data:
            songs.append({
                "id": song["id"],
                "title": song["title"]
            })
        page += 1
    return songs

def song_lyrics(song_id: int):
    try:
        # Ambil info lagu dari API
        resp = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=genius_headers(),
            timeout=15
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Gagal mengambil info lagu")
        
        song_data = resp.json()["response"]["song"]
        song_url = song_data["url"]
        song_title = song_data["title"]
        artist_name = song_data["primary_artist"]["name"]
        
        print(f"Scraping lyrics: {artist_name} - {song_title}")
        print(f"URL: {song_url}")
        
        # Method 1: Coba scraping dengan session yang lebih advanced
        lyrics = try_advanced_scraping(song_url)
        if lyrics:
            return {"lyrics": lyrics}
        
        # Method 2: Coba alternative scraping method
        lyrics = try_alternative_scraping(song_url)
        if lyrics:
            return {"lyrics": lyrics}
        
        # Method 3: Return fallback message dengan info lagu
        return {
            "lyrics": f"Sorry, lyrics for '{song_title}' by {artist_name} could not be retrieved due to website restrictions.\n\nYou can view the lyrics manually at:\n{song_url}\n\nThen copy and paste them into the manual input field above."
        }
        
    except Exception as e:
        print(f"Error in song_lyrics: {e}")
        raise HTTPException(status_code=404, detail="Lirik tidak ditemukan")

def try_advanced_scraping(song_url):
    """Advanced scraping dengan session dan better stealth"""
    try:
        # Warm up session dengan homepage visit dulu
        session.get("https://genius.com", headers=scraping_headers(), timeout=10)
        time.sleep(random.uniform(1, 3))
        
        # Scraping dengan session
        response = session.get(
            song_url,
            headers=scraping_headers(),
            timeout=20,
            allow_redirects=True
        )
        
        if response.status_code == 200:
            return extract_lyrics_from_html(response.text)
        else:
            print(f"Advanced scraping failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Advanced scraping error: {e}")
        return None

def try_alternative_scraping(song_url):
    """Alternative scraping method dengan requests biasa tapi lebih stealth"""
    try:
        # Random delay
        time.sleep(random.uniform(2, 5))
        
        # Different approach: pretend to be coming from Google
        headers = scraping_headers()
        headers['Referer'] = 'https://www.google.com/'
        
        response = requests.get(
            song_url,
            headers=headers,
            timeout=20,
            allow_redirects=True
        )
        
        if response.status_code == 200:
            return extract_lyrics_from_html(response.text)
        else:
            print(f"Alternative scraping failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Alternative scraping error: {e}")
        return None

def extract_lyrics_from_html(html_text):
    """Extract lyrics dari HTML dengan multiple methods"""
    try:
        soup = BeautifulSoup(html_text, "html.parser")
        lyrics = ""
        
        # Try multiple selectors
        selectors = [
            "div[data-lyrics-container='true']",
            "div[class*='Lyrics__Container']",
            "div[class*='lyrics']",
            ".lyrics",
            "[data-lyrics-container]"
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                for div in elements:
                    # Remove script tags and other unwanted elements
                    for script in div(["script", "style"]):
                        script.decompose()
                    lyrics += div.get_text(separator="\n")
                break
        
        if lyrics:
            # Clean up lyrics
            lines = [line.strip() for line in lyrics.split('\n') if line.strip()]
            cleaned_lines = []
            
            for line in lines:
                # Skip unwanted patterns
                skip_patterns = [
                    'you might also like',
                    'embed',
                    'see live',
                    'get tickets',
                    'more on genius',
                    'about',
                    'produced by',
                    'written by'
                ]
                
                if not any(pattern in line.lower() for pattern in skip_patterns):
                    # Remove section markers like [Verse 1], [Chorus], etc but keep them readable
                    if line.startswith('[') and line.endswith(']'):
                        cleaned_lines.append(f"\n{line}")
                    else:
                        cleaned_lines.append(line)
            
            final_lyrics = '\n'.join(cleaned_lines).strip()
            if len(final_lyrics) > 50:  # Basic validation
                return final_lyrics
        
        return None
        
    except Exception as e:
        print(f"HTML extraction error: {e}")
        return None

# Rest of the functions remain the same...
def artist_albums(artist_id: int, max_pages: int = 5):
    albums = []
    page = 1
    while page <= max_pages:
        resp = requests.get(
            f"{GENIUS_API_URL}/artists/{artist_id}/albums",
            params={"per_page": 20, "page": page},
            headers=genius_headers()
        )
        if resp.status_code != 200:
            break
        data = resp.json()["response"]["albums"]
        if not data:
            break
        for album in data:
            albums.append({
                "id": album["id"],
                "name": album["name"],
                "cover_art_url": album.get("cover_art_url"),
                "release_date": album.get("release_date"),
                "full_title": album.get("full_title"),
            })
        page += 1
    return albums

def album_songs(album_id: int):
    resp = requests.get(
        f"{GENIUS_API_URL}/albums/{album_id}/tracks",
        headers=genius_headers()
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch album songs")
    tracks = resp.json()["response"]["tracks"]
    songs = []
    for track in tracks:
        song = track["song"]
        songs.append({
            "id": song["id"],
            "title": song["title"]
        })
    return songs

def artist_singles(artist_id: int, max_pages: int = 5):
    singles = []
    page = 1
    while page <= max_pages:
        resp = requests.get(
            f"{GENIUS_API_URL}/artists/{artist_id}/songs",
            params={"per_page": 20, "page": page, "sort": "popularity"},
            headers=genius_headers()
        )
        if resp.status_code != 200:
            break
        data = resp.json()["response"]["songs"]
        if not data:
            break
        for song in data:
            if not song.get("album"):
                singles.append({
                    "id": song["id"],
                    "title": song["title"]
                })
        page += 1
    return singles