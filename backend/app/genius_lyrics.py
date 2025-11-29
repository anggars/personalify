import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"
IS_LOCAL = os.getenv("VERCEL") is None

# Worker proxy
WORKER_URL = "https://vercel.anggars.workers.dev"


# =====================================================
# HELPERS
# =====================================================

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }


def clean_lyrics(text):
    """
    - Hilangkan [Verse], [Chorus], dll
    - Hilangkan terjemahan bahasa lain
    - Hilangkan spam seperti 'lyrics', 'translation', dll
    - Normalize newline: 1 newline antar-baris, 2 newline antar-bagian
    """

    # Hilangkan annotation [Verse], [Chorus], dll
    text = re.sub(r'\[.*?\]', '', text)

    # Split raw berdasarkan newline
    lines = text.split("\n")

    cleaned = []
    for line in lines:
        s = line.strip()

        # skip baris kosong (nanti tetap dibuat 1 baris)
        if not s:
            cleaned.append("")
            continue

        # Filter blok terjemahan/translation
        blocked = [
            "translation", "translated", "português",
            "bahasa indonesia", "italian", "spanish", "lyrics",
            "click", "contribute", "read more"
        ]
        if any(b in s.lower() for b in blocked):
            continue

        # Skip weird long text
        if len(s) > 200:
            continue

        cleaned.append(s)

    # Gabung ulang
    joined = "\n".join(cleaned)

    # === Normalisasi newline ===
    # 1 newline antara baris
    joined = re.sub(r'\n{3,}', '\n\n', joined)   # maksimum 2 newline
    joined = re.sub(r'\n{2}', '\n\n', joined)    # blok antar-verse
    joined = re.sub(r'\n{1,}', '\n', joined)     # baris biasa

    # Re-apply 2 newlines antar paragraf
    joined = re.sub(r'(\S)\n(\S)', r'\1\n\2', joined)

    # Rapikan lagi kalau ada dobel
    joined = re.sub(r'\n{3,}', '\n\n', joined)

    return joined.strip()


def get_page_html(url):
    """Dipakai untuk local only."""
    try:
        r = requests.get(url, headers=get_headers(), timeout=15)
        if r.status_code == 200:
            return r.text
    except:
        pass
    return None


# =====================================================
# SEARCH ARTIST
# =====================================================

def search_artist_id(query):
    try:
        res = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": query},
            headers=get_headers(),
            timeout=10
        )

        if res.status_code != 200:
            return []

        hits = res.json()["response"]["hits"]
        artists = []
        seen = set()

        for hit in hits:
            if hit["type"] == "song":
                a = hit["result"]["primary_artist"]
                if a["id"] not in seen:
                    artists.append({
                        "id": a["id"],
                        "name": a["name"],
                        "image": a["image_url"]
                    })
                    seen.add(a["id"])

        return artists

    except:
        return []


# =====================================================
# SONG LIST
# =====================================================

def get_songs_by_artist(artist_id):
    songs = []
    page = 1

    try:
        while True:
            print(f"Fetching songs page {page}...")

            res = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={"sort": "release_date", "per_page": 50, "page": page},
                headers=get_headers(),
                timeout=20
            )

            if res.status_code != 200:
                break

            data = res.json()["response"]
            items = data["songs"]
            if not items:
                break

            for s in items:
                alb = s.get("primary_album")
                songs.append({
                    "id": s["id"],
                    "title": s["title"],
                    "image": s["song_art_image_thumbnail_url"],
                    "album": alb["name"] if alb else None,
                    "date": s.get("release_date_for_display")
                })

            if not data.get("next_page"):
                break

            page = data["next_page"]

        print(f"Total songs fetched: {len(songs)}")
        return songs

    except:
        return songs


# =====================================================
# GET LYRICS
# =====================================================

def get_lyrics_by_id(song_id):
    try:
        # metadata Genius API
        res = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=get_headers(),
            timeout=10
        )
        if res.status_code != 200:
            return None

        song = res.json()["response"]["song"]
        title = song["title"]
        artist = song["primary_artist"]["name"]
        song_url = song["url"]

        # ================================
        # DEPLOY MODE → fetch via Worker
        # ================================
        if not IS_LOCAL:
            wr = requests.get(f"{WORKER_URL}?url={song_url}", timeout=20)
            if wr.status_code != 200:
                print("Worker fail:", wr.status_code)
                return None
            html = wr.text

        # ================================
        # LOCAL MODE → direct Genius scrape
        # ================================
        else:
            html = get_page_html(song_url)
            if not html:
                print("Local fetch fail")
                return None

        # ================================
        # PARSE HTML
        # ================================
        soup = BeautifulSoup(html, "html.parser")

        lyrics_raw = ""

        # Format baru Genius (utama)
        containers = soup.find_all("div", {"data-lyrics-container": "true"})
        for c in containers:

            # filter translation block
            if "translation" in c.get_text().lower():
                continue

            for br in c.find_all("br"):
                br.replace_with("\n")

            lyrics_raw += c.get_text("\n").strip() + "\n\n"

        # Format lama Genius
        if not lyrics_raw:
            old = soup.find("div", class_="lyrics")
            if old:
                lyrics_raw = old.get_text("\n")

        if not lyrics_raw.strip():
            print("Lyrics not found")
            return None

        cleaned = clean_lyrics(lyrics_raw)

        return {
            "lyrics": cleaned,
            "title": title,
            "artist": artist,
            "url": song_url
        }

    except Exception as e:
        print("Lyrics error:", e)
        return None