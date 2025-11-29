import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"
IS_LOCAL = os.getenv("VERCEL") is None

# Worker URL (pakai punya lu)
WORKER_URL = "https://vercel.anggars.workers.dev"  # <-- ganti kalau beda nanti


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
    text = re.sub(r'\[.*?\]', '', text, flags=re.DOTALL)

    cleaned = []
    for line in text.split("\n"):
        s = line.strip()

        if not s:
            cleaned.append("")
            continue

        blocked = ["contributor", "read more", "lyrics", "translation"]
        if any(b in s.lower() for b in blocked):
            continue

        if len(s) > 200:
            continue

        cleaned.append(s)

    final = "\n".join(cleaned)
    final = re.sub(r'\n{3,}', '\n\n', final)
    return final.strip()


def get_page_html(url):
    """LOCAL ONLY: fetch langsung ke Genius tanpa worker."""
    try:
        r = requests.get(url, headers=get_headers(), timeout=15)
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print("Local fetch error:", e)
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

    except Exception as e:
        print("Search error:", e)
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

    except Exception as e:
        print("Get songs error:", e)
        return songs


# =====================================================
# GET LYRICS (LOCAL = direct Genius, DEPLOY = Worker)
# =====================================================

def get_lyrics_by_id(song_id):
    try:
        # Metadata via Genius API
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

        # --------------------------
        # DEPLOY MODE: USE WORKER
        # --------------------------
        if not IS_LOCAL:
            try:
                w = requests.get(
                    f"{WORKER_URL}?url={song_url}",
                    timeout=20
                )
                if w.status_code != 200:
                    print("Worker fetch failed:", w.status_code)
                    return None

                html = w.text

            except Exception as e:
                print("Worker error:", e)
                return None

        # --------------------------
        # LOCAL MODE: direct scrape
        # --------------------------
        else:
            html = get_page_html(song_url)
            if not html:
                print("Local Genius scrape fail")
                return None

        # --------------------------
        # PARSE HTML SAMA UNTUK LOCAL/DEPLOY
        # --------------------------
        soup = BeautifulSoup(html, "html.parser")

        lyrics_text = ""

        # Format baru Genius
        blocks = soup.find_all("div", {"data-lyrics-container": "true"})
        for div in blocks:
            for br in div.find_all("br"):
                br.replace_with("\n")
            lyrics_text += div.get_text("\n").strip() + "\n\n"

        # Format lama Genius
        if not lyrics_text:
            old = soup.find("div", class_="lyrics")
            if old:
                lyrics_text = old.get_text("\n")

        if not lyrics_text:
            print("Lyrics not found")
            return None

        cleaned = clean_lyrics(lyrics_text)

        return {
            "lyrics": cleaned,
            "title": title,
            "artist": artist,
            "url": song_url
        }

    except Exception as e:
        print("Lyrics error:", e)
        return None
