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

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

# Enhanced session with more settings
session = requests.Session()
retry_strategy = Retry(
    total=5,
    backoff_factor=2,
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

def get_random_browser_profile():
    """Generate random but consistent browser profiles"""
    profiles = [
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'sec_ch_ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec_ch_ua_platform': '"Windows"',
            'accept_language': 'en-US,en;q=0.9'
        },
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'sec_ch_ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec_ch_ua_platform': '"macOS"',
            'accept_language': 'en-US,en;q=0.9'
        },
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
            'accept_language': 'en-US,en;q=0.5'
        },
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
            'accept_language': 'en-US,en;q=0.9'
        }
    ]
    return random.choice(profiles)

def get_enhanced_headers(referer=None, profile=None):
    """Generate enhanced headers with browser profiles"""
    if not profile:
        profile = get_random_browser_profile()
    
    headers = {
        'User-Agent': profile['user_agent'],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': profile['accept_language'],
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site' if referer else 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Pragma': 'no-cache'
    }
    
    # Add Chrome-specific headers
    if 'Chrome' in profile['user_agent']:
        headers.update({
            'sec-ch-ua': profile.get('sec_ch_ua', ''),
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': profile.get('sec_ch_ua_platform', '"Windows"')
        })
    
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
        # Get song info from API
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
        
        print(f"Attempting to scrape: {artist_name} - {song_title}")
        print(f"URL: {song_url}")
        
        # Enhanced scraping methods with more aggressive approaches
        scraping_methods = [
            lambda: try_direct_scraping(song_url),
            lambda: try_session_scraping(song_url),
            lambda: try_mobile_scraping(song_url),
            lambda: try_search_engine_scraping(song_url),
            lambda: try_javascript_disabled_scraping(song_url),
            lambda: try_api_endpoint_scraping(song_id),
        ]
        
        for i, method in enumerate(scraping_methods):
            method_name = method.__name__ if hasattr(method, '__name__') else f"method_{i+1}"
            print(f"Trying {method_name}...")
            
            try:
                lyrics = method()
                if lyrics and len(lyrics.strip()) > 100:
                    print(f"✓ Success with {method_name}")
                    return {"lyrics": lyrics}
                elif lyrics:
                    print(f"✗ {method_name} returned insufficient content: {len(lyrics)} chars")
            except Exception as e:
                print(f"✗ {method_name} failed: {str(e)}")
            
            # Progressive delay between attempts
            if i < len(scraping_methods) - 1:
                delay = random.uniform(2 + i, 5 + i)
                print(f"Waiting {delay:.1f}s before next attempt...")
                time.sleep(delay)
        
        # Enhanced fallback with more options
        fallback_message = generate_fallback_message(song_title, artist_name, song_url)
        return {"lyrics": fallback_message}
        
    except Exception as e:
        print(f"Error in song_lyrics: {e}")
        raise HTTPException(status_code=404, detail="Lirik tidak ditemukan")

def try_direct_scraping(song_url):
    """Direct scraping with basic headers"""
    profile = get_random_browser_profile()
    headers = get_enhanced_headers(profile=profile)
    
    response = requests.get(song_url, headers=headers, timeout=25)
    if response.status_code == 200:
        return extract_lyrics_from_html(response.text)
    return None

def try_session_scraping(song_url):
    """Session-based scraping with warming"""
    profile = get_random_browser_profile()
    
    # Warm up session
    session.get("https://genius.com", 
                headers=get_enhanced_headers(profile=profile), 
                timeout=10)
    time.sleep(random.uniform(1, 3))
    
    # Visit search page first
    search_term = song_url.split('/')[-1].replace('-', ' ')
    session.get(f"https://genius.com/search?q={urllib.parse.quote(search_term)}", 
                headers=get_enhanced_headers(referer="https://genius.com", profile=profile),
                timeout=15)
    time.sleep(random.uniform(1, 2))
    
    # Finally get the song page
    response = session.get(song_url, 
                          headers=get_enhanced_headers(referer="https://genius.com/search", profile=profile),
                          timeout=25)
    
    if response.status_code == 200:
        return extract_lyrics_from_html(response.text)
    return None

def try_mobile_scraping(song_url):
    """Mobile user agent scraping"""
    mobile_headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    response = requests.get(song_url, headers=mobile_headers, timeout=25)
    if response.status_code == 200:
        return extract_lyrics_from_html(response.text)
    return None

def try_search_engine_scraping(song_url):
    """Simulate coming from Google search"""
    profile = get_random_browser_profile()
    headers = get_enhanced_headers(referer="https://www.google.com/search?q=genius+lyrics", profile=profile)
    headers['Accept'] = 'text/html,application/xhtml+xml'
    
    response = requests.get(song_url, headers=headers, timeout=25)
    if response.status_code == 200:
        return extract_lyrics_from_html(response.text)
    return None

def try_javascript_disabled_scraping(song_url):
    """Try with headers that suggest JS is disabled"""
    profile = get_random_browser_profile()
    headers = get_enhanced_headers(profile=profile)
    headers['Accept'] = 'text/html,application/xhtml+xml'
    headers.pop('sec-ch-ua', None)
    headers.pop('sec-ch-ua-mobile', None)
    headers.pop('sec-ch-ua-platform', None)
    
    response = requests.get(song_url, headers=headers, timeout=30)
    if response.status_code == 200:
        return extract_lyrics_from_html(response.text)
    return None

def try_api_endpoint_scraping(song_id):
    """Try to find alternative API endpoints"""
    # This is speculative - Genius might have other endpoints
    try:
        # Try different API approaches
        endpoints = [
            f"https://genius.com/api/songs/{song_id}/lyrics",
            f"https://genius.com/api/songs/{song_id}",
            f"https://api.genius.com/songs/{song_id}/lyrics"
        ]
        
        for endpoint in endpoints:
            try:
                response = requests.get(endpoint, 
                                     headers=genius_headers(), 
                                     timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if 'lyrics' in data:
                        return data['lyrics']
            except:
                continue
    except:
        pass
    
    return None

def extract_lyrics_from_html(html_text):
    """Enhanced lyrics extraction with more selectors"""
    try:
        soup = BeautifulSoup(html_text, "html.parser")
        
        # Remove unwanted elements first
        for element in soup(["script", "style", "noscript", "iframe", "nav", "header", "footer", "aside"]):
            element.decompose()
        
        lyrics_text = ""
        
        # Extended selector list with more variations
        selectors = [
            "div[data-lyrics-container='true']",
            "div[class*='Lyrics__Container']",
            "div[class*='LyricsBody__Container']",
            "div[class*='SongPage__Section']",
            "div[class*='lyrics']",
            ".lyrics",
            "[data-lyrics-container]",
            ".song_body-lyrics",
            "#lyrics-root",
            "div[class*='RichText__Container']",
            "div[class*='Verse__Container']",
            ".genius-lyrics"
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                print(f"Found lyrics using selector: {selector}")
                for element in elements:
                    text = element.get_text(separator="\n")
                    if len(text.strip()) > lyrics_text.__len__():
                        lyrics_text = text
                break
        
        # Fallback: look for JSON-LD structured data
        if not lyrics_text:
            scripts = soup.find_all('script', type='application/ld+json')
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, dict) and 'text' in data:
                        lyrics_text = data['text']
                        break
                except:
                    continue
        
        # Another fallback: pattern matching for lyrics
        if not lyrics_text:
            all_text = soup.get_text()
            # Look for patterns that suggest lyrics
            patterns = [
                r'\[Verse.*?\](.*?)(?=\[|$)',
                r'\[Chorus.*?\](.*?)(?=\[|$)',
                r'(\[.*?\].*?(?=\[|$))'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, all_text, re.DOTALL | re.IGNORECASE)
                if matches and len(' '.join(matches)) > 100:
                    lyrics_text = ' '.join(matches)
                    break
        
        if lyrics_text:
            cleaned = clean_lyrics(lyrics_text)
            if cleaned:
                return cleaned
        
        return None
        
    except Exception as e:
        print(f"HTML extraction error: {e}")
        return None

def clean_lyrics(raw_lyrics):
    """Enhanced lyrics cleaning"""
    if not raw_lyrics:
        return None
    
    # Split into lines and clean
    lines = [line.strip() for line in raw_lyrics.split('\n') if line.strip()]
    
    # Extended skip patterns
    skip_patterns = [
        'you might also like', 'embed', 'see live', 'get tickets',
        'more on genius', 'about', 'produced by', 'written by',
        'genius.com', 'advertisement', 'subscribe', 'follow',
        'share', 'genius lyrics', 'download', 'stream',
        'listen on spotify', 'apple music', 'youtube',
        'credits', 'tags', 'comments', 'annotation'
    ]
    
    cleaned_lines = []
    for line in lines:
        line_lower = line.lower()
        
        # Skip unwanted content
        if any(pattern in line_lower for pattern in skip_patterns):
            continue
            
        # Skip URLs and social media handles
        if any(x in line_lower for x in ['http', 'www.', '@', '#hashtag']):
            continue
            
        # Skip very short lines that are likely UI elements
        if len(line) < 2:
            continue
        
        # Format section headers
        if line.startswith('[') and line.endswith(']'):
            cleaned_lines.append(f"\n{line}")
        else:
            cleaned_lines.append(line)
    
    final_lyrics = '\n'.join(cleaned_lines).strip()
    
    # Validation: should have reasonable length and structure
    if (len(final_lyrics) > 100 and 
        not all(c.isdigit() or c.isspace() for c in final_lyrics) and
        len(final_lyrics.split()) > 20):
        return final_lyrics
    
    return None

def generate_fallback_message(song_title, artist_name, song_url):
    """Generate helpful fallback message"""
    return f'''🎵 Unable to automatically retrieve lyrics for "{song_title}" by {artist_name}

🚫 COMMON ISSUES:
• Anti-bot protection active
• Lyrics require login/subscription  
• Regional content restrictions
• Rate limiting in effect
• JavaScript-heavy page structure

✅ MANUAL SOLUTION:
1. Open: {song_url}
2. Copy all the lyrics from the page
3. Switch to "Manual Input" mode (dropdown above)
4. Paste the lyrics in the text area
5. Click "Analyze Lyrics"

💡 TIP: Try opening the link in an incognito/private window if you encounter any issues.

🔄 You can switch modes using the dropdown at the top of this page.'''

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