import os
import requests
import re
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
    }

def clean_lyrics(text):
    # Bersihkan tag bracket seperti [Verse 1]
    text = re.sub(r'\[.*?\]', '', text)
    # Hapus baris kosong berlebih
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# --- FUNGSI FALLBACK: LRCLIB (Anti-Blokir) ---
def fetch_lyrics_from_lrclib(track_name, artist_name):
    """
    Cadangan kalau Genius nge-blokir IP Render.
    Ambil lirik dari LrcLib (Gratis, No Key, No Block).
    """
    try:
        print(f"⚠️ Genius Blocked/Failed. Switching to LrcLib fallback for: {track_name}")
        url = "https://lrclib.net/api/get"
        params = {
            "artist_name": artist_name,
            "track_name": track_name
        }
        # LrcLib aman pakai requests biasa
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            # LrcLib kasih 'plainLyrics' atau 'syncedLyrics'. Kita ambil plain.
            return data.get('plainLyrics')
    except Exception as e:
        print(f"LrcLib Fallback Error: {e}")
    return None

# --- 1. SEARCH & 2. GET SONGS (API GENIUS - BIASANYA AMAN) ---
# Kita tetap pakai cffi_requests biar konsisten, tapi API jarang blokir IP.

def fetch_genius_api(url, params=None):
    try:
        return cffi_requests.get(
            url, 
            params=params, 
            headers=get_headers(),
            impersonate="chrome110", 
            timeout=15
        )
    except Exception:
        return None

def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    response = fetch_genius_api(f"{GENIUS_API_URL}/search", params={'q': query})
    
    if response and response.status_code == 200:
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
    return []

def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 3 
    try:
        while page <= MAX_PAGES:
            response = fetch_genius_api(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={'sort': 'popularity', 'per_page': 50, 'page': page}
            )
            if not response or response.status_code != 200: break
            
            data = response.json()['response']
            for song in data['songs']:
                songs.append({
                    'id': song['id'],
                    'title': song['title'],
                    'image': song['song_art_image_thumbnail_url']
                })
            
            if not data.get('next_page'): break
            page = data.get('next_page')
        return songs
    except Exception:
        return songs

# --- 3. SCRAPE LIRIK (INITI MASALAHNYA) ---
def get_lyrics_by_id(song_id):
    # Step A: Ambil Metadata dari API Genius (Judul & Artis)
    # Ini penting buat fallback nanti
    meta_resp = fetch_genius_api(f"{GENIUS_API_URL}/songs/{song_id}")
    if not meta_resp or meta_resp.status_code != 200: 
        return None
    
    song_data = meta_resp.json()['response']['song']
    song_title = song_data['title']
    song_artist = song_data['primary_artist']['name']
    song_url = song_data['url']
    
    lyrics_text = ""

    # Step B: Coba Scrape Genius HTML (Usaha Utama)
    try:
        print(f"Attempting to scrape Genius: {song_url}")
        
        # Session membantu menyimpan cookies agar terlihat seperti manusia
        with cffi_requests.Session() as s:
            # Gunakan versi chrome spesifik & header lengkap
            s.impersonate = "chrome110"
            s.headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://genius.com/",
            }
            
            page_resp = s.get(song_url, timeout=15)
            
            if page_resp.status_code == 200:
                soup = BeautifulSoup(page_resp.text, 'html.parser')
                
                # Logic selector Genius
                divs = soup.find_all('div', attrs={'data-lyrics-container': 'true'})
                if divs:
                    for div in divs:
                        for br in div.find_all("br"): br.replace_with("\n")
                        lyrics_text += div.get_text() + "\n\n"
                
                if not lyrics_text:
                    old_div = soup.find('div', class_='lyrics')
                    if old_div: lyrics_text = old_div.get_text()
                    
            else:
                print(f"Genius Scraping Blocked/Failed: {page_resp.status_code}")

    except Exception as e:
        print(f"Genius Scraping Error: {e}")

    # Step C: FALLBACK MECHANISM (Penyelamat)
    # Kalau scraping Genius gagal (kosong), kita tembak LrcLib
    if not lyrics_text or len(lyrics_text.strip()) < 10:
        fallback_lyrics = fetch_lyrics_from_lrclib(song_title, song_artist)
        if fallback_lyrics:
            lyrics_text = fallback_lyrics
            print(">>> Success fetching lyrics from LrcLib fallback!")
        else:
            print(">>> LrcLib fallback also failed.")

    # Step D: Return hasil (Entah dari Genius atau LrcLib)
    if lyrics_text:
        return {
            "lyrics": clean_lyrics(lyrics_text),
            "title": song_title,
            "artist": song_artist,
            "url": song_url
        }
    
    return None