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

# --- FUNGSI REQUEST SAKTI (Revisi Stabil) ---
def make_genius_request(endpoint, params=None):
    """
    Mengatur strategi request:
    1. Jika ada SCRAPER_API_KEY (Render) -> Lewat Proxy ScraperAPI
    2. Jika tidak ada (Lokal) -> Lewat Direct Request biasa
    """
    if params is None:
        params = {}
    
    # URL Target Asli Genius
    target_url = f"{GENIUS_API_URL}{endpoint}"
    
    # Masukkan Token Genius ke params (Wajib untuk API Genius)
    if GENIUS_TOKEN:
        params['access_token'] = GENIUS_TOKEN

    if SCRAPER_API_KEY:
        # [MODE RENDER/PREMIUM] - Pakai ScraperAPI
        print(f"DEBUG: Menggunakan ScraperAPI untuk {endpoint}")
        
        # Trik: Kita tidak encode manual params ke string URL.
        # Kita kirim params terpisah ke requests, tapi URL targetnya
        # kita biarkan 'requests' yang menggabungkannya nanti.
        # ScraperAPI butuh 'api_key' dan 'url' (target).
        
        # 1. Konstruksi URL target lengkap dengan query params secara manual
        #    Ini lebih aman agar ScraperAPI menerima URL yang utuh.
        from urllib.parse import urlencode
        query_string = urlencode(params)
        full_target_url = f"{target_url}?{query_string}"
        
        payload = {
            'api_key': SCRAPER_API_KEY,
            'url': full_target_url
        }
        
        try:
            # Timeout 60 detik karena lewat proxy
            return requests.get('http://api.scraperapi.com', params=payload, timeout=60)
        except Exception as e:
            print(f"ScraperAPI Error: {e}")
            # Fallback darurat: coba direct request kalau scraper mati
            return requests.get(target_url, params=params, timeout=15)
            
    else:
        # [MODE LOKAL/GRATIS] - Direct Request
        print(f"DEBUG: Direct Request ke {endpoint}")
        headers = {"Authorization": f"Bearer {GENIUS_TOKEN}"} if GENIUS_TOKEN else {}
        return requests.get(target_url, params=params, headers=headers, timeout=15)

# 1. CARI ARTIS
def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    try:
        response = make_genius_request("/search", {'q': query})
        
        if response.status_code == 200:
            hits = response.json()['response']['hits']
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
            print(f"Search failed. Code: {response.status_code}. Response: {response.text[:200]}")
            return []
    except Exception as e:
        print(f"Error search artist: {e}")
        return []

# 2. AMBIL LIST LAGU
def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 2 
    
    try:
        while page <= MAX_PAGES:
            response = make_genius_request(
                f"/artists/{artist_id}/songs",
                {'sort': 'popularity', 'per_page': 20, 'page': page}
            )
            
            if response.status_code != 200:
                print(f"Get songs failed: {response.status_code}")
                break
                
            data = response.json()['response']
            songs_data = data['songs']
            
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
        # STEP 1: Ambil Metadata (Pake Helper)
        response = make_genius_request(f"/songs/{song_id}")
        
        if response.status_code != 200: 
            print(f"Metadata failed: {response.status_code}")
            return None
        
        song_data = response.json()['response']['song']
        song_url = song_data['url']
        
        # STEP 2: Scrape HTML Liriknya (Untuk HTML, URL target beda)
        page_resp = None
        if SCRAPER_API_KEY:
            # ScraperAPI Mode
            payload = {
                'api_key': SCRAPER_API_KEY,
                'url': song_url # URL halaman web genius, bukan API
            }
            try:
                page_resp = requests.get('http://api.scraperapi.com', params=payload, timeout=60)
            except:
                pass
        
        # Fallback jika ScraperAPI gagal atau tidak ada key
        if not page_resp or page_resp.status_code != 200:
            # Coba direct request dengan User-Agent browser
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            page_resp = requests.get(song_url, headers=headers, timeout=15)

        if not page_resp or page_resp.status_code != 200: 
            return None
        
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
                "title": song_data['title'],
                "artist": song_data['primary_artist']['name'],
                "url": song_url
            }
    except Exception as e:
        print(f"Scrape error: {e}")
        return None
    return None