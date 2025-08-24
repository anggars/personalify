import os
import requests
import time
import random
from fastapi import HTTPException
from bs4 import BeautifulSoup
import urllib.parse
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

# Session dengan retry strategy
session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

def genius_headers():
    return {"Authorization": f"Bearer {GENIUS_TOKEN}"}

def get_random_user_agent():
    """Rotate user agents untuk avoid detection"""
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/121.0.0.0'
    ]
    return random.choice(user_agents)

def get_scraping_headers(referer=None):
    """Headers yang lebih realistic dan bervariasi"""
    headers = {
        'User-Agent': get_random_user_agent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site' if referer else 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
    }
    
    if referer:
        headers['Referer'] = referer
    
    return headers

def search_artist(q: str):
    resp = requests.get(
        f"{GENIUS_API_URL}/search",
        params={"q": q},
        headers=genius_headers(),
        timeout=10
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
            headers=genius_headers(),
            timeout=10
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
        
        # Multi-method scraping approach
        scraping_methods = [
            lambda: try_stealth_scraping(song_url),
            lambda: try_mobile_scraping(song_url),
            lambda: try_proxy_scraping(song_url),
            lambda: try_delayed_scraping(song_url),
        ]
        
        for i, method in enumerate(scraping_methods):
            print(f"Trying scraping method {i+1}...")
            lyrics = method()
            if lyrics and len(lyrics.strip()) > 100:  # Valid lyrics should be substantial
                print(f"Success with method {i+1}")
                return {"lyrics": lyrics}
            elif lyrics:
                print(f"Method {i+1} returned short content: {len(lyrics)} chars")
            
            # Wait between attempts
            if i < len(scraping_methods) - 1:
                time.sleep(random.uniform(2, 4))
        
        # All methods failed - return helpful fallback
        fallback_message = f"""Unable to automatically retrieve lyrics for "{song_title}" by {artist_name}.

This can happen due to:
• Website anti-bot protection
• Lyrics behind login wall
• Regional restrictions
• Rate limiting

MANUAL SOLUTION:
1. Visit: {song_url}
2. Copy the lyrics from the page
3. Paste them in the "Manual Input" mode above
4. Click "Analyze Lyrics"

You can switch to Manual mode using the dropdown at the top of the page."""

        return {"lyrics": fallback_message}
        
    except Exception as e:
        print(f"Error in song_lyrics: {e}")
        raise HTTPException(status_code=404, detail="Lirik tidak ditemukan")

def try_stealth_scraping(song_url):
    """Stealth scraping dengan session warming"""
    try:
        # Warm up dengan homepage visit
        session.get("https://genius.com", 
                   headers=get_scraping_headers(), 
                   timeout=10)
        time.sleep(random.uniform(1, 3))
        
        # Main request
        response = session.get(
            song_url,
            headers=get_scraping_headers(referer="https://genius.com"),
            timeout=20,
            allow_redirects=True
        )
        
        if response.status_code == 200:
            return extract_lyrics_from_html(response.text)
        
        return None
    except Exception as e:
        print(f"Stealth scraping error: {e}")
        return None

def try_mobile_scraping(song_url):
    """Try with mobile user agent"""
    try:
        mobile_headers = get_scraping_headers()
        mobile_headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
        
        response = requests.get(
            song_url,
            headers=mobile_headers,
            timeout=20
        )
        
        if response.status_code == 200:
            return extract_lyrics_from_html(response.text)
        
        return None
    except Exception as e:
        print(f"Mobile scraping error: {e}")
        return None

def try_proxy_scraping(song_url):
    """Try with different approach - simulating Google referrer"""
    try:
        headers = get_scraping_headers(referer="https://www.google.com/search?q=genius+lyrics")
        headers['Accept'] = 'text/html,application/xhtml+xml'
        
        response = requests.get(
            song_url,
            headers=headers,
            timeout=25
        )
        
        if response.status_code == 200:
            return extract_lyrics_from_html(response.text)
        
        return None
    except Exception as e:
        print(f"Proxy scraping error: {e}")
        return None

def try_delayed_scraping(song_url):
    """Final attempt with maximum delay"""
    try:
        time.sleep(random.uniform(3, 6))
        
        headers = get_scraping_headers()
        headers['Cache-Control'] = 'no-cache'
        
        response = requests.get(
            song_url,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            return extract_lyrics_from_html(response.text)
        
        return None
    except Exception as e:
        print(f"Delayed scraping error: {e}")
        return None

def extract_lyrics_from_html(html_text):
    """Extract lyrics dengan multiple selectors dan cleaning"""
    try:
        soup = BeautifulSoup(html_text, "html.parser")
        lyrics_text = ""
        
        # Extended list of selectors to try
        selectors = [
            "div[data-lyrics-container='true']",
            "div[class*='Lyrics__Container']",
            "div[class*='LyricsBody__Container']",
            "div[class*='lyrics']",
            ".lyrics",
            "[data-lyrics-container]",
            ".song_body-lyrics",
            "#lyrics-root",
            "div[class*='SongPage__Section']"
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                print(f"Found lyrics with selector: {selector}")
                for element in elements:
                    # Remove unwanted elements
                    for tag in element(["script", "style", "noscript", "iframe"]):
                        tag.decompose()
                    lyrics_text += element.get_text(separator="\n")
                break
        
        if not lyrics_text:
            # Fallback: look for any div containing substantial text
            all_divs = soup.find_all('div')
            for div in all_divs:
                text = div.get_text().strip()
                if len(text) > 200 and any(keyword in text.lower() for keyword in ['verse', 'chorus', 'bridge', 'outro', 'intro']):
                    lyrics_text = text
                    print("Found lyrics using fallback method")
                    break
        
        if lyrics_text:
            return clean_lyrics(lyrics_text)
        
        return None
        
    except Exception as e:
        print(f"HTML extraction error: {e}")
        return None

def clean_lyrics(raw_lyrics):
    """Clean and format lyrics"""
    if not raw_lyrics:
        return None
    
    lines = [line.strip() for line in raw_lyrics.split('\n') if line.strip()]
    cleaned_lines = []
    
    # Patterns to skip
    skip_patterns = [
        'you might also like',
        'embed',
        'see live',
        'get tickets',
        'more on genius',
        'about',
        'produced by',
        'written by',
        'genius.com',
        'advertisement',
        'subscribe',
        'follow',
        'share',
        'genius lyrics'
    ]
    
    for line in lines:
        line_lower = line.lower()
        
        # Skip unwanted patterns
        if any(pattern in line_lower for pattern in skip_patterns):
            continue
        
        # Skip very short lines that are likely navigation
        if len(line) < 3:
            continue
        
        # Format section headers nicely
        if line.startswith('[') and line.endswith(']'):
            cleaned_lines.append(f"\n{line}")
        else:
            cleaned_lines.append(line)
    
    final_lyrics = '\n'.join(cleaned_lines).strip()
    
    # Basic validation
    if len(final_lyrics) > 50 and not all(c.isdigit() or c.isspace() for c in final_lyrics):
        return final_lyrics
    
    return None

# Keep existing functions for albums/singles
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