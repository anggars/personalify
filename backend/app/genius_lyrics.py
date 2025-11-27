import os
import re
from bs4 import BeautifulSoup
# Kita pakai curl_cffi untuk SEMUA request, bukan cuma scraping
from curl_cffi import requests as cffi_requests 

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        # User-Agent tidak perlu ditulis manual, curl_cffi akan mengurusnya
    }

def clean_lyrics(text):
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# --- FUNGSI BANTUAN BARU ---
def fetch_genius(url, params=None):
    """
    Fungsi tunggal untuk request ke Genius.
    Menggunakan impersonate='chrome' agar dikira browser asli, bukan bot.
    """
    try:
        print(f"Genius Request: {url}")
        response = cffi_requests.get(
            url,
            params=params,
            headers=get_headers(),
            impersonate="chrome", # KUNCI ANTI BLOKIR
            timeout=15
        )
        return response
    except Exception as e:
        print(f"Request Error: {e}")
        return None

# 1. CARI ARTIS (SEKARANG PAKAI CURL_CFFI)
def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    
    response = fetch_genius(f"{GENIUS_API_URL}/search", params={'q': query})
    
    if response and response.status_code == 200:
        try:
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
        except Exception as e:
            print(f"Parse Error (Search): {e}")
    else:
        print(f"Search failed via Render. Status: {response.status_code if response else 'None'}")
            
    return []

# 2. AMBIL LIST LAGU (SEKARANG PAKAI CURL_CFFI)
def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 3 
    
    try:
        while page <= MAX_PAGES:
            response = fetch_genius(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={'sort': 'popularity', 'per_page': 50, 'page': page}
            )
            
            if not response or response.status_code != 200:
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

# 3. SCRAPE LIRIK (SUDAH CURL_CFFI DARI TADI)
def get_lyrics_by_id(song_id):
    try:
        # A. Ambil Metadata Lagu
        response = fetch_genius(f"{GENIUS_API_URL}/songs/{song_id}")
        if not response or response.status_code != 200: return None
        
        song_data = response.json()['response']['song']
        song_url = song_data['url']
        
        # B. Scrape HTML Halaman Lirik
        print(f"Scraping Lyrics URL: {song_url}")
        
        # Kita panggil cffi_requests langsung di sini karena butuh URL non-API
        page_resp = cffi_requests.get(
            song_url, 
            impersonate="chrome", 
            timeout=15
        )
        
        if page_resp.status_code != 200: 
            print(f"Failed to fetch lyrics page: {page_resp.status_code}")
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