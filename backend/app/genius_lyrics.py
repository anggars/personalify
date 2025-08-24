import os
import requests
import time
from fastapi import HTTPException
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def genius_headers():
    return {"Authorization": f"Bearer {GENIUS_TOKEN}"}

def scraping_headers():
    """Headers untuk scraping yang lebih convincing"""
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
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
            timeout=10
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Gagal mengambil info lagu")
        
        song_url = resp.json()["response"]["song"]["url"]
        print(f"Scraping lyrics from: {song_url}")
        
        # Scraping dengan retry mechanism
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Tambah delay untuk avoid rate limit
                if attempt > 0:
                    time.sleep(2)
                
                html_resp = requests.get(
                    song_url, 
                    headers=scraping_headers(),
                    timeout=15,
                    allow_redirects=True
                )
                
                if html_resp.status_code != 200:
                    print(f"HTTP {html_resp.status_code} on attempt {attempt + 1}")
                    continue
                
                soup = BeautifulSoup(html_resp.text, "html.parser")
                lyrics = ""
                
                # Try multiple selectors (Genius changes their structure sometimes)
                selectors = [
                    "div[data-lyrics-container='true']",
                    "div.lyrics",
                    "div[class*='lyrics']",
                    "div[class*='Lyrics__Container']"
                ]
                
                for selector in selectors:
                    elements = soup.select(selector)
                    if elements:
                        for div in elements:
                            lyrics += div.get_text(separator="\n")
                        break
                
                lyrics = lyrics.strip()
                
                if lyrics:
                    # Clean up lyrics
                    lines = lyrics.split('\n')
                    cleaned_lines = []
                    for line in lines:
                        line = line.strip()
                        if line and not line.startswith('[') and not line.endswith(']'):
                            # Remove common unwanted patterns
                            if not any(skip in line.lower() for skip in ['embed', 'you might also like', 'see live']):
                                cleaned_lines.append(line)
                    
                    final_lyrics = '\n'.join(cleaned_lines)
                    if final_lyrics:
                        return {"lyrics": final_lyrics}
                
            except requests.RequestException as e:
                print(f"Request error on attempt {attempt + 1}: {e}")
                continue
            except Exception as e:
                print(f"Parse error on attempt {attempt + 1}: {e}")
                continue
        
        # Jika semua attempt gagal, coba fallback method
        return fallback_lyrics_method(song_id)
        
    except Exception as e:
        print(f"Error in song_lyrics: {e}")
        raise HTTPException(status_code=404, detail=f"Lirik tidak ditemukan: {str(e)}")

def fallback_lyrics_method(song_id: int):
    """Fallback method jika scraping gagal"""
    try:
        # Coba ambil dari API lagi dengan parameter berbeda
        resp = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=genius_headers(),
            params={"text_format": "plain"},
            timeout=10
        )
        
        if resp.status_code == 200:
            song_data = resp.json()["response"]["song"]
            # Beberapa lagu mungkin punya lyrics di API response
            if "lyrics" in song_data and song_data["lyrics"]:
                return {"lyrics": song_data["lyrics"]}
        
        # Jika masih gagal, return message
        raise HTTPException(status_code=404, detail="Lirik tidak dapat diambil dari server")
        
    except Exception as e:
        raise HTTPException(status_code=404, detail="Lirik tidak dapat diambil")

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
            # Jika tidak punya album, berarti single
            if not song.get("album"):
                singles.append({
                    "id": song["id"],
                    "title": song["title"]
                })
        page += 1
    return singles