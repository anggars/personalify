import os
import requests
import time
import random
from fastapi import HTTPException
from bs4 import BeautifulSoup
import urllib.parse
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import re
from urllib.parse import urljoin, urlparse

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

# Global session with connection pooling
session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(
    max_retries=retry_strategy,
    pool_connections=10,
    pool_maxsize=20
)
session.mount("http://", adapter)
session.mount("https://", adapter)

def genius_headers():
    return {"Authorization": f"Bearer {GENIUS_TOKEN}"}

def get_browser_profile():
    """Get realistic browser profiles"""
    profiles = [
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'platform': 'Windows',
            'viewport': '1920x1080'
        },
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'platform': 'macOS',
            'viewport': '1440x900'
        },
        {
            'user_agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'platform': 'Linux',
            'viewport': '1920x1080'
        }
    ]
    return random.choice(profiles)

def get_stealth_headers(referer=None, profile=None):
    """Generate stealth headers that mimic real browser behavior"""
    if not profile:
        profile = get_browser_profile()
    
    headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Dnt': '1',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': f'"{profile["platform"]}"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin' if referer else 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': profile['user_agent']
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
        # Get song info
        resp = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=genius_headers(),
            timeout=15
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get song info")
        
        song_data = resp.json()["response"]["song"]
        song_url = song_data["url"]
        song_title = song_data["title"]
        artist_name = song_data["primary_artist"]["name"]
        
        print(f"Attempting to scrape: {artist_name} - {song_title}")
        
        # Try different scraping strategies
        strategies = [
            ("Direct Request", lambda: direct_scrape(song_url)),
            ("Stealth Session", lambda: stealth_scrape(song_url)),
            ("Mobile Agent", lambda: mobile_scrape(song_url)),
            ("Cached Version", lambda: cached_scrape(song_url)),
            ("Alternative Sources", lambda: alternative_scrape(artist_name, song_title)),
        ]
        
        for strategy_name, strategy_func in strategies:
            print(f"Trying: {strategy_name}")
            try:
                result = strategy_func()
                if result and len(result.strip()) > 150:  # Require substantial content
                    print(f"✓ Success with {strategy_name}")
                    return {"lyrics": result}
                elif result:
                    print(f"✗ {strategy_name} returned minimal content: {len(result)} chars")
            except Exception as e:
                print(f"✗ {strategy_name} failed: {str(e)[:100]}")
            
            # Progressive delay
            time.sleep(random.uniform(1, 3))
        
        # Enhanced fallback with more helpful info
        return {"lyrics": create_enhanced_fallback(song_title, artist_name, song_url)}
        
    except Exception as e:
        print(f"Error in song_lyrics: {e}")
        raise HTTPException(status_code=404, detail="Song not found")

def direct_scrape(song_url):
    """Direct scraping with rotating headers"""
    profile = get_browser_profile()
    headers = get_stealth_headers(profile=profile)
    
    response = requests.get(song_url, headers=headers, timeout=20)
    if response.status_code == 200:
        return extract_lyrics(response.text)
    return None

def stealth_scrape(song_url):
    """Advanced stealth scraping with session warming"""
    profile = get_browser_profile()
    
    # Multi-step browsing simulation
    steps = [
        ("https://genius.com", "Homepage visit"),
        ("https://genius.com/artists", "Browse artists"),
        (song_url, "Target page")
    ]
    
    last_url = None
    for url, description in steps:
        print(f"  - {description}")
        headers = get_stealth_headers(referer=last_url, profile=profile)
        
        try:
            response = session.get(url, headers=headers, timeout=15)
            if url == song_url and response.status_code == 200:
                return extract_lyrics(response.text)
            last_url = url
            time.sleep(random.uniform(0.5, 2))
        except Exception as e:
            print(f"    Error in {description}: {e}")
            break
    
    return None

def mobile_scrape(song_url):
    """Mobile user agent scraping"""
    mobile_agents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
        'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
    ]
    
    headers = {
        'User-Agent': random.choice(mobile_agents),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    response = requests.get(song_url, headers=headers, timeout=20)
    if response.status_code == 200:
        return extract_lyrics(response.text)
    return None

def cached_scrape(song_url):
    """Try to find cached/archived versions"""
    cached_urls = [
        f"https://web.archive.org/web/{song_url}",
        f"https://webcache.googleusercontent.com/search?q=cache:{song_url}",
    ]
    
    for cached_url in cached_urls:
        try:
            headers = get_stealth_headers()
            response = requests.get(cached_url, headers=headers, timeout=25)
            if response.status_code == 200:
                lyrics = extract_lyrics(response.text)
                if lyrics:
                    return lyrics
        except:
            continue
    
    return None

def alternative_scrape(artist_name, song_title):
    """Try alternative lyrics sources as last resort"""
    # Note: This would typically involve other lyrics sites
    # But we should be careful about copyright and ToS
    print("  - Checking alternative sources...")
    
    # For now, just return None to fall back to manual
    # In production, you might integrate with other APIs that have proper licensing
    return None

def extract_lyrics(html_content):
    """Enhanced lyrics extraction"""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove scripts, styles, and other non-content elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            element.decompose()
        
        # Try multiple selectors in order of preference
        selectors = [
            'div[data-lyrics-container="true"]',
            'div[class*="Lyrics__Container"]',
            'div[class*="LyricsBody__Container"]', 
            'div[class*="SongPage__Section"]',
            '.lyrics',
            'div[class*="lyrics"]',
            '[data-lyrics-container]'
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                lyrics_parts = []
                for element in elements:
                    text = element.get_text(separator='\n').strip()
                    if text:
                        lyrics_parts.append(text)
                
                if lyrics_parts:
                    combined_lyrics = '\n'.join(lyrics_parts)
                    cleaned = clean_extracted_lyrics(combined_lyrics)
                    if cleaned and len(cleaned) > 100:
                        return cleaned
        
        # Fallback: search for structured data
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                data = json.loads(script.string)
                if 'lyrics' in str(data).lower():
                    # Try to extract lyrics from JSON
                    lyrics_text = extract_from_json(data)
                    if lyrics_text:
                        return clean_extracted_lyrics(lyrics_text)
            except:
                continue
        
        return None
        
    except Exception as e:
        print(f"Extraction error: {e}")
        return None

def extract_from_json(data):
    """Extract lyrics from JSON-LD or other structured data"""
    if isinstance(data, dict):
        for key, value in data.items():
            if 'lyric' in key.lower() and isinstance(value, str):
                return value
            elif isinstance(value, (dict, list)):
                result = extract_from_json(value)
                if result:
                    return result
    elif isinstance(data, list):
        for item in data:
            result = extract_from_json(item)
            if result:
                return result
    return None

def clean_extracted_lyrics(raw_text):
    """Clean and validate extracted lyrics"""
    if not raw_text:
        return None
    
    lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
    
    # Filter out common non-lyrics content
    filtered_lines = []
    skip_patterns = [
        'you might also like', 'embed', 'see live', 'get tickets',
        'more on genius', 'produced by', 'written by', 'genius.com',
        'advertisement', 'subscribe', 'follow', 'download', 'stream',
        'spotify', 'apple music', 'youtube', 'soundcloud'
    ]
    
    for line in lines:
        line_lower = line.lower()
        
        # Skip promotional/navigation content
        if any(pattern in line_lower for pattern in skip_patterns):
            continue
        
        # Skip URLs and handles
        if any(x in line_lower for x in ['http', 'www.', '@']):
            continue
        
        # Keep section markers and actual lyrics
        if len(line) >= 2:  # Minimum length
            filtered_lines.append(line)
    
    if not filtered_lines:
        return None
    
    cleaned_text = '\n'.join(filtered_lines)
    
    # Final validation
    word_count = len(cleaned_text.split())
    if word_count > 15 and len(cleaned_text) > 100:
        return cleaned_text
    
    return None

def create_enhanced_fallback(song_title, artist_name, song_url):
    """Create informative fallback message"""
    return f"""🎵 Lyrics retrieval failed for "{song_title}" by {artist_name}

🔒 PROTECTION DETECTED:
• Website has advanced anti-scraping measures
• Content may be dynamically loaded via JavaScript  
• Rate limiting or IP-based restrictions active
• Login or subscription might be required

📋 MANUAL STEPS:
1. 🌐 Visit: {song_url}
2. 📝 Select and copy all lyrics from the page
3. ⚙️  Switch to "Manual Input" mode (dropdown above)
4. 📄 Paste lyrics in the text area
5. 🎯 Click "Analyze Lyrics" button

💡 TROUBLESHOOTING TIPS:
• Try opening in incognito/private mode
• Disable ad blockers temporarily  
• Check if you need to create a Genius account
• Some lyrics may require premium access

🔄 Use the mode dropdown above to switch to Manual Input."""

# Keep existing album/singles functions unchanged
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