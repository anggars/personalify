import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

# Jika tidak ada ENV VERCEL → berarti jalan di lokal
IS_LOCAL = os.getenv("VERCEL") is None


# ========================= HELPERS ===============================

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }


def normalize(text):
    """Convert artist/title menjadi format URL AZLyrics."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]', '', text)
    return text


def clean_lyrics(text):
    text = re.sub(r'\[.*?\]', '', text, flags=re.DOTALL)

    cleaned_lines = []
    for line in text.split("\n"):
        strip = line.strip()

        if not strip:
            cleaned_lines.append("")
            continue

        blocked = [
            "contributor", "contribute",
            "translation", "lyrics",
            "read more", "português",
        ]
        if any(b in strip.lower() for b in blocked):
            continue

        if len(strip) > 200:
            continue

        cleaned_lines.append(strip)

    final = "\n".join(cleaned_lines)
    final = re.sub(r'\n{3,}', '\n\n', final).strip()
    return final


def get_page_html(url):
    """Hanya dipakai di LOCAL, tidak dipakai di deploy."""
    try:
        r = requests.get(url, headers=get_headers(), timeout=15)
        if r.status_code == 200:
            return r.text
        print("Local fetch error:", r.status_code)
    except Exception as e:
        print("Local direct fetch error:", e)
    return None


# ======================= AZLYRICS SCRAPER =======================

def fetch_from_azlyrics(artist, title):
    """Scraping lirik dari AZLyrics — dipakai di DEPLOY."""
    artist_clean = normalize(artist)
    title_clean = normalize(title)

    url = f"https://www.azlyrics.com/lyrics/{artist_clean}/{title_clean}.html"

    try:
        r = requests.get(url, timeout=15)
        if r.status_code != 200:
            print("AZLyrics status:", r.status_code)
            return None

        soup = BeautifulSoup(r.text, "html.parser")

        # Lyrics ada di <div> ke-3 yang tidak punya class
        divs = soup.find_all("div", class_=None)

        for div in divs:
            text = div.get_text("\n").strip()
            if len(text) > 200:  # heuristik: pasti lirik
                return text

        return None

    except Exception as e:
        print("AZLyrics error:", e)
        return None


# ========================= SEARCH ARTIST ===========================

def search_artist_id(query):
    if not GENIUS_TOKEN:
        return []

    try:
        response = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": query},
            headers=get_headers(),
            timeout=10
        )

        if response.status_code == 200:
            hits = response.json()["response"]["hits"]
            artists = []
            seen_ids = set()

            for hit in hits:
                if hit["type"] == "song":
                    artist = hit["result"]["primary_artist"]

                    if artist["id"] not in seen_ids:
                        artists.append({
                            "id": artist["id"],
                            "name": artist["name"],
                            "image": artist["image_url"]
                        })
                        seen_ids.add(artist["id"])

            return artists

    except Exception as e:
        print("Error search artist:", e)

    return []


# ======================= GET SONG LIST ============================

def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    MAX_PAGES = 20

    try:
        while page <= MAX_PAGES:
            print(f"Fetching songs page {page}...")

            response = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={"sort": "release_date", "per_page": 50, "page": page},
                headers=get_headers(),
                timeout=20
            )

            if response.status_code != 200:
                break

            data = response.json()["response"]
            songs_data = data["songs"]

            if not songs_data:
                break

            for song in songs_data:
                primary_album = song.get("primary_album")
                album_name = primary_album.get("name") if primary_album else None

                songs.append({
                    "id": song["id"],
                    "title": song["title"],
                    "image": song["song_art_image_thumbnail_url"],
                    "album": album_name,
                    "date": song.get("release_date_for_display")
                })

            next_page = data.get("next_page")
            if not next_page:
                break

            page = next_page

        print(f"Total songs fetched: {len(songs)}")
        return songs

    except Exception as e:
        print("Error get songs:", e)
        return songs


# ======================= GET LYRICS ============================

def get_lyrics_by_id(song_id):
    try:
        # 1. Ambil metadata dari Genius API
        response = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=get_headers(),
            timeout=10
        )
        if response.status_code != 200:
            return None

        song_data = response.json()["response"]["song"]
        title = song_data["title"]
        artist = song_data["primary_artist"]["name"]
        song_url = song_data["url"]

        # ==========================================================
        # DEPLOY MODE → PAKAI AZLYRICS
        # ==========================================================
        if not IS_LOCAL:
            lyrics = fetch_from_azlyrics(artist, title)

            if lyrics:
                return {
                    "lyrics": clean_lyrics(lyrics),
                    "title": title,
                    "artist": artist,
                    "url": song_url,
                }

            print("AZLyrics gagal → tidak ada fallback di deploy.")
            return None

        # ==========================================================
        # LOCAL MODE → SCRAPING HTML GENIUS FULL
        # ==========================================================
        html = get_page_html(song_url)
        if not html:
            print("Local scrape error: gagal ambil HTML")
            return None

        soup = BeautifulSoup(html, "html.parser")
        lyrics_text = ""

        containers = soup.find_all("div", {"data-lyrics-container": "true"})
        for div in containers:
            for br in div.find_all("br"):
                br.replace_with("\n")
            lyrics_text += div.get_text(separator="\n").strip() + "\n\n"

        if not lyrics_text:
            old_div = soup.find("div", class_="lyrics")
            if old_div:
                lyrics_text = old_div.get_text(separator="\n")

        if not lyrics_text:
            print("❌ Local scrape: lirik tidak ditemukan")
            return None

        final_lyrics = clean_lyrics(lyrics_text)

        return {
            "lyrics": final_lyrics,
            "title": title,
            "artist": artist,
            "url": song_url
        }

    except Exception as e:
        print("Lyrics fetch error:", e)
        return None
