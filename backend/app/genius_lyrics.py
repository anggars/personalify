import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

IS_DEPLOY = os.getenv("VERCEL") == "1"
SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY")

def get_page_html(url):
    # LOCAL MODE → direct request (lebih cepat & tanpa ScraperAPI)
    if not IS_DEPLOY:
        try:
            r = requests.get(url, headers=get_headers(), timeout=20)
            if r.status_code == 200:
                return r.text
            print("Local fetch error:", r.status_code)
        except Exception as e:
            print("Local direct fetch error:", e)
        return None

    # DEPLOY MODE → gunakan ScraperAPI
    if not SCRAPER_API_KEY:
        print("❌ SCRAPER_API_KEY missing in environment")
        return None

    try:
        r = requests.get(
            "http://api.scraperapi.com",
            params={
                "api_key": SCRAPER_API_KEY,
                "url": url,
                "country_code": "us",
                "render": "true"
            },
            timeout=20,
        )

        if r.status_code == 200:
            return r.text

        print("ScraperAPI Error:", r.status_code, r.text[:300])
    except Exception as e:
        print("ScraperAPI Request Error:", e)

    return None

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

def clean_lyrics(text):
    # Hilangkan semua label section: [Intro], [Verse], dll
    text = re.sub(r'\[.*?\]', '', text, flags=re.DOTALL)

    cleaned_lines = []
    for line in text.split("\n"):
        strip = line.strip()

        # --- FILTER BARIS YANG BUKAN LIRIK ---
        if not strip:
            cleaned_lines.append("")
            continue
        
        # buang metadata umum genius
        blocked = [
            "contributor", "contribute",
            "translation", "lyrics", 
            "read more", "português", 
        ]

        if any(b in strip.lower() for b in blocked):
            continue

        # buang paragraf promosi / info album (biasanya panjang > 120 char)
        if len(strip) > 200:
            continue

        cleaned_lines.append(strip)

    # Hilangkan line kosong berlebihan
    final = "\n".join(cleaned_lines)
    final = re.sub(r'\n{3,}', '\n\n', final).strip()
    return final


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
        # 1. Ambil metadata lagu
        response = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=get_headers(),
            timeout=10
        )
        if response.status_code != 200:
            return None

        song_data = response.json()['response']['song']
        song_url = song_data['url']

        # 2. Ambil halaman HTML lewat ScraperAPI
        html = get_page_html(song_url)
        if not html:
            print("GAGAL AMBIL HTML via ScraperAPI")
            return None

        soup = BeautifulSoup(html, "html.parser")

        # 3. Cari kontainer lirik baru
        lyrics_text = ""
        containers = soup.find_all("div", {"data-lyrics-container": "true"})

        if containers:
            for div in containers:
                # Convert <br> → newline
                for br in div.find_all("br"):
                    br.replace_with("\n")

                lyrics_text += div.get_text(separator="\n").strip() + "\n\n"

        # 4. Fallback lama
        if not lyrics_text:
            old_div = soup.find("div", class_="lyrics")
            if old_div:
                lyrics_text = old_div.get_text(separator="\n")

        if not lyrics_text:
            print("❌ Lirik TIDAK ditemukan di HTML")
            return None

        # 5. Bersihkan lirik
        final_lyrics = clean_lyrics(lyrics_text)

        return {
            "lyrics": final_lyrics,
            "title": song_data['title'],
            "artist": song_data['primary_artist']['name'],
            "url": song_url,
        }

    except Exception as e:
        print("Scrape error:", e)
        return None
