# backend/app/genius_lyrics.py - FURTHER IMPROVED VERSION
import os
import requests
from fastapi import HTTPException
import time
from urllib.parse import quote
import random
import re

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def get_random_user_agent():
    """Return a random user agent to avoid detection"""
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0"
    ]
    return random.choice(user_agents)

def genius_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": get_random_user_agent(),
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9"
    }

def search_artist(q: str):
    try:
        resp = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": q},
            headers=genius_headers(),
            timeout=10
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to search artist")
        results = resp.json()["response"]["hits"]
        artists = []
        seen = set()
        for hit in results:
            artist = hit["result"]["primary_artist"]
            if artist["id"] not in seen:
                artists.append({"id": artist["id"], "name": artist["name"]})
                seen.add(artist["id"])
        return artists
    except Exception as e:
        print(f"Search artist error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

def artist_songs(artist_id: int, max_pages: int = 3):
    songs = []
    page = 1
    while page <= max_pages:
        try:
            resp = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={"per_page": 20, "page": page, "sort": "popularity"},
                headers=genius_headers(),
                timeout=15
            )
            if resp.status_code != 200:
                print(f"Error fetching songs page {page}: {resp.status_code}")
                break
            data = resp.json()["response"]["songs"]
            if not data:
                break
            for song in data:
                songs.append({
                    "id": song["id"],
                    "title": song["title"],
                    "url": song.get("url", ""),
                    "artist": song["primary_artist"]["name"]
                })
            page += 1
            time.sleep(0.3)  # Small delay
        except Exception as e:
            print(f"Error fetching songs: {e}")
            break
    return songs

def get_lyrics_from_alternative_api(song_title: str, artist_name: str):
    """Try multiple alternative lyrics APIs"""
    
    # Clean song title and artist name
    clean_title = re.sub(r'[^\w\s]', '', song_title).strip()
    clean_artist = re.sub(r'[^\w\s]', '', artist_name).strip()
    
    # Try lyrics.ovh
    try:
        url = f"https://api.lyrics.ovh/v1/{quote(clean_artist)}/{quote(clean_title)}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'lyrics' in data and data['lyrics'] and len(data['lyrics'].strip()) > 50:
                return data['lyrics'].strip()
    except Exception as e:
        print(f"lyrics.ovh API error: {e}")
    
    # Try lyricsfreak alternative approach (if available)
    try:
        # This is just an example - you can add more APIs here
        # Like azlyrics scraper, musixmatch, etc.
        pass
    except Exception as e:
        print(f"Alternative API 2 error: {e}")
    
    return None

def scrape_lyrics_advanced(song_url: str):
    """Advanced lyrics scraping with multiple strategies"""
    
    session = requests.Session()
    
    # Multiple user agents rotation
    headers = {
        "User-Agent": get_random_user_agent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0"
    }
    
    session.headers.update(headers)
    
    try:
        # Add random delay to seem more human-like
        time.sleep(random.uniform(0.5, 1.5))
        
        response = session.get(song_url, timeout=20)
        if response.status_code != 200:
            print(f"Failed to fetch page: {response.status_code}")
            return None
        
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove script and style elements first
        for script in soup(["script", "style", "nav", "header", "footer"]):
            script.decompose()
        
        # Try multiple selectors in order of preference
        selectors = [
            'div[class*="Lyrics__Container"]',
            'div[data-lyrics-container="true"]',
            'div[class*="lyrics"]',
            '.lyrics',
            'div[class*="SongPage__Section"]',
            'div[class*="Verse"]',
            'div[class*="song_body"]'
        ]
        
        lyrics_text = ""
        
        for selector in selectors:
            try:
                lyrics_divs = soup.select(selector)
                if lyrics_divs:
                    lyrics_parts = []
                    for div in lyrics_divs:
                        # Get text with better formatting
                        text = div.get_text(separator="\n", strip=True)
                        if text and len(text.strip()) > 20:
                            lyrics_parts.append(text)
                    
                    if lyrics_parts:
                        lyrics_text = "\n\n".join(lyrics_parts)
                        print(f"Found lyrics using selector: {selector}")
                        break
            except Exception as e:
                print(f"Error with selector {selector}: {e}")
                continue
        
        if lyrics_text:
            # Advanced cleaning
            return clean_lyrics_text(lyrics_text)
        
        # Fallback: try to find any div with substantial text content
        all_divs = soup.find_all('div')
        for div in all_divs:
            text = div.get_text(strip=True)
            if len(text) > 200 and 'lyrics' in div.get('class', []) + [div.get('id', '')]:
                lyrics_text = text
                break
        
        if lyrics_text:
            return clean_lyrics_text(lyrics_text)
            
        return None
        
    except Exception as e:
        print(f"Advanced scraping error: {e}")
        return None

def clean_lyrics_text(raw_text: str) -> str:
    """Clean and format lyrics text"""
    if not raw_text:
        return ""
    
    lines = raw_text.split('\n')
    cleaned_lines = []
    
    # Patterns to skip
    skip_patterns = [
        r'embed', r'advertisement', r'genius', r'share', r'copy', r'url',
        r'http', r'www', r'\.com', r'click', r'subscribe', r'follow',
        r'see more', r'show more', r'read more', r'contributors',
        r'produced by', r'written by', r'lyrics for', r'song by'
    ]
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 2:
            continue
            
        line_lower = line.lower()
        
        # Skip obvious non-lyric content
        if any(re.search(pattern, line_lower) for pattern in skip_patterns):
            continue
            
        # Keep section markers and actual lyrics
        if (line.startswith('[') and line.endswith(']')) or len(line) > 5:
            cleaned_lines.append(line)
    
    # Join and clean up excessive whitespace
    result = '\n'.join(cleaned_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)  # Max 2 consecutive newlines
    return result.strip()

def song_lyrics(song_id: int):
    """Main lyrics function with multiple fallback strategies"""
    
    if not GENIUS_TOKEN:
        raise HTTPException(status_code=500, detail="Genius API token not configured")
    
    try:
        # Get song info
        resp = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=genius_headers(),
            timeout=10
        )
        
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get song info")
        
        song_data = resp.json()["response"]["song"]
        song_title = song_data["title"]
        artist_name = song_data["primary_artist"]["name"]
        song_url = song_data["url"]
        
        print(f"Attempting to get lyrics for: {song_title} by {artist_name}")
        
        # Strategy 1: Try alternative APIs first (often more reliable)
        print("Trying alternative lyrics APIs...")
        alt_lyrics = get_lyrics_from_alternative_api(song_title, artist_name)
        if alt_lyrics and len(alt_lyrics.strip()) > 100:
            print("✅ Success with alternative API!")
            return {
                "lyrics": alt_lyrics,
                "manual_needed": False,
                "source": "alternative_api"
            }
        
        # Strategy 2: Advanced Genius scraping
        print("Trying advanced Genius scraping...")
        scraped_lyrics = scrape_lyrics_advanced(song_url)
        if scraped_lyrics and len(scraped_lyrics.strip()) > 100:
            print("✅ Success with advanced scraping!")
            return {
                "lyrics": scraped_lyrics,
                "manual_needed": False,
                "source": "genius_scrape"
            }
        
        # Strategy 3: Manual fallback with helpful info
        print("❌ All automatic methods failed, returning manual fallback")
        return {
            "lyrics": f"Lyrics for '{song_title}' by {artist_name} could not be retrieved automatically.\n\n📝 Please copy the lyrics from the Genius page and paste them here.\n\n💡 Tip: Visit the link below, copy the lyrics, then come back and paste them in the text area.",
            "manual_needed": True,
            "song_title": song_title,
            "artist": artist_name,
            "url": song_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in song_lyrics: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# Keep the old functions for backward compatibility
def song_lyrics_improved(song_id: int):
    return song_lyrics(song_id)

def artist_albums(artist_id: int, max_pages: int = 5):
    """Get artist albums (optional feature)"""
    albums = []
    page = 1
    while page <= max_pages:
        try:
            resp = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/albums",
                params={"per_page": 20, "page": page},
                headers=genius_headers(),
                timeout=15
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
            time.sleep(0.3)
        except Exception as e:
            print(f"Error fetching albums: {e}")
            break
    return albums

# For testing purposes - you can call this to test the functions
if __name__ == "__main__":
    # Test with Reality Club song
    try:
        result = song_lyrics(30938787)  # Example song ID
        print("Test result:", result)
    except Exception as e:
        print("Test failed:", e)