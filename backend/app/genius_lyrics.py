import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY") 
GENIUS_API_URL = "https://api.genius.com"

def clean_lyrics(text):
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# --- REQUEST HELPER (STRATEGI BARU) ---
def make_request(url, params=None, headers=None, use_proxy=False):
    if params is None: params = {}
    if headers is None: headers = {}

    # Selalu sertakan Header Authorization (penting buat Direct Request)
    if GENIUS_TOKEN:
        headers["Authorization"] = f"Bearer {GENIUS_TOKEN}"
    
    # Tambahkan User-Agent biar gak dikira bot jahat
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    try:
        if use_proxy and SCRAPER_API_KEY:
            # --- METODE 1: HTTP PROXY (Lebih Stabil untuk Lirik) ---
            # Kita pakai ScraperAPI sebagai "Standard Proxy"
            # Format: http://scraperapi:APIKEY@proxy-server.scraperapi.com:8001
            print(f"DEBUG: [Proxy] Requesting {url}...")
            proxies = {
                "http": f"http://scraperapi:{SCRAPER_API_KEY}@proxy-server.scraperapi.com:8001",
                "https": f"http://scraperapi:{SCRAPER_API_KEY}@proxy-server.scraperapi.com:8001"
            }
            # Verify=False kadang perlu buat ScraperAPI biar gak error SSL
            return requests.get(url, params=params, headers=headers, proxies=proxies, verify=False, timeout=50)
        else:
            # --- METODE 2: DIRECT REQUEST (Cepat untuk Search) ---
            print(f"DEBUG: [Direct] Requesting {url}...")
            return requests.get(url, params=params, headers=headers, timeout=15)
            
    except Exception as e:
        print(f"Request Error ({url}): {e}")
        return None

# 1. CARI ARTIS -> WAJIB DIRECT (Biar Cepet & Gak Timeout Vercel)
def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    
    # Search ke API biasanya aman dari blokir IP, jadi Direct aja biar ngebut
    response = make_request(f"{GENIUS_API_URL}/search", params={'q': query}, use_proxy=False)

    if response and response.status_code == 200:
        try:
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
        except:
            pass
    return []

# 2. AMBIL LIST LAGU -> WAJIB DIRECT (Biar Cepet)
def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 2 
    
    try:
        while page <= MAX_PAGES:
            response = make_request(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={'sort': 'popularity', 'per_page': 20, 'page': page},
                use_proxy=False # Direct aja
            )
            
            if not response or response.status_code != 200:
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
    except:
        pass

    return songs

# 3. AMBIL LIRIK -> INI BARU PAKE PROXY SCRAPERAPI
def get_lyrics_by_id(song_id):
    # Step A: Ambil Metadata (API) - Direct (Cepat)
    response = make_request(f"{GENIUS_API_URL}/songs/{song_id}", use_proxy=False)
    
    if not response or response.status_code != 200: 
        return None
    
    try:
        song_data = response.json().get('response', {}).get('song', {})
        song_url = song_data.get('url') # Ini URL website genius (HTML)
        
        if not song_url: return None

        # Step B: Ambil HTML Lirik - PROXY (Rawan Blokir)
        # Kita coba Direct dulu (siapa tau lolos), kalau gagal baru Proxy
        # (Opsional: Langsung Proxy kalau di Render biar pasti tembus)
        
        # Coba Direct dulu (hemat credit & waktu)
        page_resp = make_request(song_url, use_proxy=False)
        
        # Kalau Direct gagal/diblokir (biasanya 403), baru nyalain ScraperAPI
        if not page_resp or page_resp.status_code != 200:
            print("DEBUG: Direct scrape failed, switching to ScraperAPI...")
            page_resp = make_request(song_url, use_proxy=True) # <--- PAKE PROXY
        
        if not page_resp or page_resp.status_code != 200:
            return None
        
        # Parsing HTML
        soup = BeautifulSoup(page_resp.text, 'html.parser')
        lyrics_text = ""
        
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
        print(f"Scrape error: {e}")
        return None

    return None