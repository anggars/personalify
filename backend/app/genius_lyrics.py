import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

def clean_lyrics(text):
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# 1. CARI ARTIS
def search_artist_id(query):
    if not GENIUS_TOKEN: return []
    try:
        response = requests.get(
            f"{GENIUS_API_URL}/search",
            params={'q': query},
            headers=get_headers(),
            timeout=10
        )
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
    except Exception as e:
        print(f"Error search artist: {e}")
    return []

# 2. AMBIL LIST LAGU (SORT BY RELEASE DATE - TERBARU)
def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 20 
    
    try:
        while page <= MAX_PAGES:
            print(f"Fetching songs page {page} (Sorted by Release Date)...")
            
            response = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={'sort': 'release_date', 'per_page': 50, 'page': page},
                headers=get_headers(),
                timeout=20
            )
            
            if response.status_code != 200:
                break
                
            data = response.json()['response']
            songs_data = data['songs']
            
            if not songs_data:
                break
                
            for song in songs_data:
                # --- PERBAIKAN LOGIKA ALBUM ---
                # Cek apakah ada objek primary_album
                primary_album = song.get('primary_album')
                
                if primary_album:
                    album_name = primary_album.get('name')
                else:
                    # Jika null (biasanya Single), kita kosongkan saja biar rapi
                    # Atau bisa diganti "Single" jika mau
                    album_name = None 

                release_date = song.get('release_date_for_display')

                songs.append({
                    'id': song['id'],
                    'title': song['title'],
                    'image': song['song_art_image_thumbnail_url'],
                    'album': album_name,       # Bisa None sekarang
                    'date': release_date
                })
            
            next_page = data.get('next_page')
            if not next_page:
                break
                
            page = next_page

        print(f"Total songs fetched: {len(songs)}")
        return songs

    except Exception as e:
        print(f"Error get songs: {e}")
        return songs

# 3. SCRAPE LIRIK
def get_lyrics_by_id(song_id):
    try:
        response = requests.get(f"{GENIUS_API_URL}/songs/{song_id}", headers=get_headers(), timeout=10)
        if response.status_code != 200: return None
        
        song_data = response.json()['response']['song']
        song_url = song_data['url']
        
        page_resp = requests.get(song_url, headers=get_headers(), timeout=15)
        if page_resp.status_code != 200: return None
        
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