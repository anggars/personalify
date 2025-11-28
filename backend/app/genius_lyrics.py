import os
import requests
import re
from bs4 import BeautifulSoup
from urllib.parse import urlencode

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY") 
GENIUS_API_URL = "https://api.genius.com"

def clean_lyrics(text):
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# --- FUNGSI REQUEST SAKTI (Revisi Anti-Timeout) ---
def make_genius_request(endpoint, params=None):
    if params is None:
        params = {}
    
    full_url = f"{GENIUS_API_URL}{endpoint}"
    
    # --- JALUR 1: RENDER / PRODUCTION (ScraperAPI) ---
    if SCRAPER_API_KEY:
        print(f"DEBUG: [ScraperAPI] Requesting {endpoint}...")
        
        proxy_params = params.copy()
        if GENIUS_TOKEN:
            proxy_params['access_token'] = GENIUS_TOKEN
            
        # Encode manual URL target
        query_string = urlencode(proxy_params)
        target_url = f"{full_url}?{query_string}"
        
        payload = {
            'api_key': SCRAPER_API_KEY,
            'url': target_url,
            'country_code': 'us', # Tambahan: Pakai IP US biar lebih stabil
            'keep_headers': 'true' # Tambahan: Coba pertahankan header
        }
        
        try:
            # PENTING: Timeout diset 25s (di bawah batas Vercel 30s)
            # Biar kalau lemot, backend masih sempet lapor error ke frontend
            # daripada diputus paksa sama Vercel (504 Gateway Timeout).
            response = requests.get('http://api.scraperapi.com', params=payload, timeout=25)
            
            print(f"DEBUG: [ScraperAPI] Status Code: {response.status_code}")
            return response
            
        except Exception as e:
            print(f"DEBUG: [ScraperAPI] Error/Timeout: {e}")
            # JANGAN FALLBACK ke Direct Request di Render.
            # Karena IP Render pasti diblokir (403), cuma buang waktu & bikin timeout.
            # Mending return None atau response error dummy biar frontend tau.
            return None

    # --- JALUR 2: LOKAL (Direct Request) ---
    else:
        print(f"DEBUG: [Direct] Requesting {endpoint}...")
        headers = {
            "Authorization": f"Bearer {GENIUS_TOKEN}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        try:
            return requests.get(full_url, params=params, headers=headers, timeout=15)
        except Exception as e:
            print(f"DEBUG: [Direct] Error: {e}")
            return None

# 1. CARI ARTIS
def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    try:
        response = make_genius_request("/search", {'q': query})
        
        # Cek kalau response valid dan sukses
        if response and response.status_code == 200:
            hits = response.json().get('response', {}).get('hits', [])
            artists = []
            seen_ids = set()
            for hit in hits:
                if hit['type'] == 'song':
                    artist = hit['result']['primary_artist']
                    if artist['id'] not in seen_ids:
                        artists.append({
                            'id': artist['id'],
                            'name': artist['name'],
                            'image': artist['image_url']
                        })
                        seen_ids.add(artist['id'])
            return artists
        else:
            # Log error buat debugging di Render Dashboard
            code = response.status_code if response else "No Response"
            text = response.text[:100] if response else "None"
            print(f"Search failed. Code: {code} | Body: {text}")
            return []
            
    except Exception as e:
        print(f"Error search artist function: {e}")
        return []

# 2. AMBIL LIST LAGU
def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 2 # Hemat credit & waktu
    
    try:
        while page <= MAX_PAGES:
            response = make_genius_request(
                f"/artists/{artist_id}/songs",
                {'sort': 'popularity', 'per_page': 20, 'page': page}
            )
            
            if not response or response.status_code != 200:
                print(f"Get songs failed page {page}")
                break
                
            data = response.json().get('response', {})
            songs_data = data.get('songs', [])
            
            if not songs_data:
                break
                
            for song in songs_data:
                songs.append({
                    'id': song['id'],
                    'title': song['title'],
                    'image': song['song_art_image_thumbnail_url']
                })
            
            next_page = data.get('next_page')
            if not next_page:
                break
                
            page = next_page

        return songs

    except Exception as e:
        print(f"Error get songs: {e}")
        return songs

# 3. SCRAPE LIRIK
def get_lyrics_by_id(song_id):
    try:
        # STEP 1: Ambil Metadata (API)
        response = make_genius_request(f"/songs/{song_id}")
        
        if not response or response.status_code != 200: 
            return None
        
        song_data = response.json().get('response', {}).get('song', {})
        song_url = song_data.get('url')
        
        if not song_url:
            return None

        # STEP 2: Scrape HTML Lirik (Web Page)
        page_resp = None
        
        if SCRAPER_API_KEY:
            # Mode ScraperAPI untuk HTML
            # Note: URL targetnya adalah halaman web, bukan API
            payload = {
                'api_key': SCRAPER_API_KEY,
                'url': song_url,
                'country_code': 'us' 
            }
            try:
                page_resp = requests.get('http://api.scraperapi.com', params=payload, timeout=55)
            except Exception as e:
                print(f"Scrape HTML Error: {e}")
        else:
            # Mode Lokal Direct
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            page_resp = requests.get(song_url, headers=headers, timeout=15)

        if not page_resp or page_resp.status_code != 200: 
            return None
        
        soup = BeautifulSoup(page_resp.text, 'html.parser')
        lyrics_text = ""
        
        # Parsing Lirik Genius
        divs = soup.find_all('div', attrs={'data-lyrics-container': 'true'})
        if divs:
            for div in divs:
                for br in div.find_all("br"):
                    br.replace_with("\n")
                lyrics_text += div.get_text() + "\n\n"
        
        if not lyrics_text:
            old_div = soup.find('div', class_='lyrics')
            if old_div: lyrics_text = old_div.get_text()

        if lyrics_text:
            return {
                "lyrics": clean_lyrics(lyrics_text),
                "title": song_data.get('title'),
                "artist": song_data.get('primary_artist', {}).get('name'),
                "url": song_url
            }
    except Exception as e:
        print(f"Scrape logic error: {e}")
        return None
    return None