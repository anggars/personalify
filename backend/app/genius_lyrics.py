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

# --- FUNGSI REQUEST SAKTI (Helper Baru) ---
def make_genius_request(endpoint, params=None):
    """
    Mengatur strategi request:
    1. Jika ada SCRAPER_API_KEY (Render) -> Lewat Proxy ScraperAPI
    2. Jika tidak ada (Lokal) -> Lewat Direct Request biasa
    """
    if params is None:
        params = {}
    
    full_url = f"{GENIUS_API_URL}{endpoint}"
    
    # Masukkan Token Genius ke params (biar aman lewat proxy URL)
    if GENIUS_TOKEN:
        params['access_token'] = GENIUS_TOKEN

    if SCRAPER_API_KEY:
        # [MODE RENDER/PREMIUM] - Pakai ScraperAPI
        # Kita encode URL target + params genius jadi satu string url panjang
        target_url_with_params = full_url + '?' + urlencode(params)
        
        payload = {
            'api_key': SCRAPER_API_KEY,
            'url': target_url_with_params
        }
        # Timeout digedein karena lewat proxy butuh waktu
        return requests.get('http://api.scraperapi.com', params=payload, timeout=60)
    else:
        # [MODE LOKAL/GRATIS] - Direct Request
        headers = {"Authorization": f"Bearer {GENIUS_TOKEN}"} if GENIUS_TOKEN else {}
        return requests.get(full_url, params=params, headers=headers, timeout=15)

# 1. CARI ARTIS (Sekarang Pake ScraperAPI juga)
def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    try:
        # Panggil helper function kita
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
            print(f"Search failed. Status: {response.status_code} | Text: {response.text[:100]}")
    except Exception as e:
        print(f"Error search artist: {e}")
    return []

# 2. AMBIL LIST LAGU (Sekarang Pake ScraperAPI juga)
def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 2 # Kurangi jadi 2 page biar hemat credit & gak timeout
    
    try:
        while page <= MAX_PAGES:
            # Panggil helper function kita
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

# 3. SCRAPE LIRIK (Tetap Pake Logic Lama tapi Rapih)
def get_lyrics_by_id(song_id):
    try:
        # STEP 1: Ambil Metadata (Pake Helper ScraperAPI)
        response = make_genius_request(f"/songs/{song_id}")
        
        if response.status_code != 200: return None
        
        song_data = response.json()['response']['song']
        song_url = song_data['url']
        
        # STEP 2: Scrape HTML Liriknya
        page_resp = None
        if SCRAPER_API_KEY:
            # ScraperAPI Mode untuk HTML
            payload = {
                'api_key': SCRAPER_API_KEY,
                'url': song_url
            }
            page_resp = requests.get('http://api.scraperapi.com', params=payload, timeout=60)
        else:
            # Direct Mode
            page_resp = requests.get(song_url, timeout=15)

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