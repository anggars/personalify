# backend/app/genius_lyrics.py - UPDATED VERSION
import os
import requests
from fastapi import HTTPException
import time
from urllib.parse import quote

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def genius_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

def search_artist(q: str):
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

def artist_songs(artist_id: int, max_pages: int = 3):  # Reduced pages for better performance
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
                    "url": song.get("url", "")  # Store URL for potential scraping
                })
            page += 1
            time.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f"Error fetching songs: {e}")
            break
    return songs

def song_lyrics_improved(song_id: int):
    """
    Improved lyrics fetching with multiple fallback strategies
    """
    try:
        # Strategy 1: Try to get song info first
        resp = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=genius_headers(),
            timeout=10
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get song info")
        
        song_data = resp.json()["response"]["song"]
        song_url = song_data["url"]
        
        # Strategy 2: Try scraping with improved headers and error handling
        lyrics = scrape_lyrics_robust(song_url)
        
        if not lyrics or len(lyrics.strip()) < 50:
            # Strategy 3: Fallback - return song info for manual input
            return {
                "lyrics": f"Sorry, lyrics for '{song_data['title']}' by {song_data['primary_artist']['name']} could not be automatically retrieved.\n\nYou can:\n1. Search for the lyrics manually and paste them\n2. Try a different song\n3. Visit: {song_url}",
                "manual_needed": True,
                "song_title": song_data['title'],
                "artist": song_data['primary_artist']['name'],
                "url": song_url
            }
        
        return {"lyrics": lyrics, "manual_needed": False}
        
    except Exception as e:
        print(f"Error in song_lyrics_improved: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process lyrics: {str(e)}")

def scrape_lyrics_robust(song_url: str):
    """
    Robust lyrics scraping with multiple selectors and error handling
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none"
    }
    
    try:
        session = requests.Session()
        session.headers.update(headers)
        
        response = session.get(song_url, timeout=15)
        if response.status_code != 200:
            print(f"Failed to fetch page: {response.status_code}")
            return None
            
        # Import BeautifulSoup here to avoid import issues
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Multiple selector strategies for different Genius page layouts
        selectors = [
            'div[class*="Lyrics__Container"]',
            'div[data-lyrics-container="true"]',
            'div.lyrics',
            'div[class*="lyrics"]',
            'div[class*="SongPage__Section"]'
        ]
        
        lyrics_text = ""
        
        for selector in selectors:
            lyrics_divs = soup.select(selector)
            if lyrics_divs:
                lyrics_parts = []
                for div in lyrics_divs:
                    # Remove script and style elements
                    for script in div(["script", "style"]):
                        script.decompose()
                    
                    # Get text content
                    text = div.get_text(separator="\n", strip=True)
                    if text and len(text) > 20:  # Only add substantial text
                        lyrics_parts.append(text)
                
                if lyrics_parts:
                    lyrics_text = "\n\n".join(lyrics_parts)
                    break
        
        # Clean up the lyrics text
        if lyrics_text:
            # Remove common non-lyric elements
            lines = lyrics_text.split('\n')
            cleaned_lines = []
            
            skip_patterns = [
                'embed', 'lyrics', 'genius', 'advertisement',
                'share', 'copy', 'url', 'http', 'www'
            ]
            
            for line in lines:
                line = line.strip()
                if line and len(line) > 2:
                    # Skip lines that are likely not lyrics
                    line_lower = line.lower()
                    if not any(pattern in line_lower for pattern in skip_patterns):
                        if not line.startswith('[') or line.startswith('[Verse') or line.startswith('[Chorus'):
                            cleaned_lines.append(line)
            
            return '\n'.join(cleaned_lines) if cleaned_lines else None
            
        return None
        
    except Exception as e:
        print(f"Scraping error: {e}")
        return None

# Alternative: Use a lyrics API service (recommended)
def get_lyrics_from_alternative_api(song_title: str, artist_name: str):
    """
    Alternative method using other lyrics APIs
    You can integrate with services like:
    - Musixmatch API
    - Lyrics.ovh
    - AZLyrics (unofficial)
    """
    try:
        # Example using lyrics.ovh (free, no API key needed)
        url = f"https://api.lyrics.ovh/v1/{quote(artist_name)}/{quote(song_title)}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if 'lyrics' in data and data['lyrics']:
                return data['lyrics']
    except Exception as e:
        print(f"Alternative API error: {e}")
    
    return None

# Updated function that combines both methods
def song_lyrics(song_id: int):
    """
    Main lyrics function that tries multiple methods
    """
    # First try the improved scraping method
    try:
        result = song_lyrics_improved(song_id)
        return result
    except Exception as e:
        print(f"Primary method failed: {e}")
        
        # Fallback: Try to get song info and use alternative API
        try:
            resp = requests.get(
                f"{GENIUS_API_URL}/songs/{song_id}",
                headers=genius_headers(),
                timeout=10
            )
            if resp.status_code == 200:
                song_data = resp.json()["response"]["song"]
                
                # Try alternative API
                alt_lyrics = get_lyrics_from_alternative_api(
                    song_data['title'], 
                    song_data['primary_artist']['name']
                )
                
                if alt_lyrics:
                    return {"lyrics": alt_lyrics, "manual_needed": False}
                else:
                    return {
                        "lyrics": f"Lyrics for '{song_data['title']}' by {song_data['primary_artist']['name']} could not be found automatically.\n\nPlease paste the lyrics manually or try a different song.",
                        "manual_needed": True,
                        "song_title": song_data['title'],
                        "artist": song_data['primary_artist']['name']
                    }
        except Exception as fallback_error:
            print(f"Fallback method also failed: {fallback_error}")
            
        raise HTTPException(status_code=500, detail="All lyrics retrieval methods failed")