import os
import requests
import re
from bs4 import BeautifulSoup

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def get_headers():
    return {
        "Authorization": f"Bearer {GENIUS_TOKEN}",
        "User-Agent": "CompuServe Classic/1.22"
    }

def clean_lyrics(text):
    text = re.sub(r"\[.*?\]", "", text)
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        s = line.strip()
        if not s: continue
        if re.match(r"^\d+\s+contributors?$", s.lower()): continue
        blocked = [
            "translation", "translated", "lyrics",
            "click", "contribute", "read more",
            "produced by", "written by"
        ]
        if any(b in s.lower() for b in blocked): continue
        cleaned.append(s)
    return "\n".join(cleaned)

def get_page_html(url):
    try:
        translate_url = f"https://translate.google.com/translate?sl=auto&tl=en&u={url}&client=webapp"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        print(f"ATTEMPTING GOOGLE TRANSLATE PROXY: {url}")
        r = requests.get(translate_url, headers=headers, timeout=20)
        
        if r.status_code == 200:
            return r.text
        else:
            print(f"GOOGLE TRANSLATE BLOCKED ({r.status_code})")
            return None
            
    except Exception as e:
        print(f"GOOGLE TRANSLATE ERROR: {e}")
        return None

def search_artist_id(query):
    try:
        res = requests.get(
            f"{GENIUS_API_URL}/search",
            params={"q": query},
            headers=get_headers(),
            timeout=10
        )
        if res.status_code != 200: return []
        hits = res.json()["response"]["hits"]
        artists = []
        seen = set()
        for hit in hits:
            if hit["type"] == "song":
                a = hit["result"]["primary_artist"]
                if a["id"] not in seen:
                    artists.append({"id": a["id"], "name": a["name"], "image": a["image_url"]})
                    seen.add(a["id"])
        return artists
    except: return []

def get_songs_by_artist(artist_id):
    songs = []
    page = 1
    try:
        while True:
            print(f"FETCHING SONGS PAGE {page}...")
            res = requests.get(
                f"{GENIUS_API_URL}/artists/{artist_id}/songs",
                params={"sort": "release_date", "per_page": 50, "page": page},
                headers=get_headers(),
                timeout=20
            )
            if res.status_code != 200: break
            data = res.json()["response"]
            items = data["songs"]
            if not items: break
            for s in items:
                alb = s.get("primary_album")
                songs.append({
                    "id": s["id"],
                    "title": s["title"],
                    "image": s["song_art_image_thumbnail_url"],
                    "album": alb["name"] if alb else None,
                    "date": s.get("release_date_for_display")
                })
            if not data.get("next_page"): break
            page = data["next_page"]
        print(f"TOTAL SONGS FETCHED: {len(songs)}")
        return songs
    except: return songs

def get_lyrics_by_id(song_id):
    try:
        res = requests.get(
            f"{GENIUS_API_URL}/songs/{song_id}",
            headers=get_headers(),
            timeout=10
        )
        if res.status_code != 200:
            print(f"METADATA FETCH FAILED: {res.status_code}")
            return None

        song = res.json()["response"]["song"]
        title = song["title"]
        artist = song["primary_artist"]["name"]
        song_url = song["url"]

        html = get_page_html(song_url)

        if not html:
            print("FAILED TO RETRIEVE LYRICS HTML.")
            return None

        soup = BeautifulSoup(html, "html.parser")
        
        containers = soup.select("div[data-lyrics-container]")
        all_lines = []
        
        for c in containers:
            if "translation" in c.get_text().lower(): continue
            for br in c.find_all("br"): br.replace_with("\n")
            block = c.get_text("\n").strip()
            if block: 
                lines = block.split("\n")
                for line in lines:
                    stripped = line.strip()
                    if stripped: all_lines.append(stripped)
                    else: all_lines.append("") 

        lyrics_raw = "\n".join(all_lines)
        
        if not lyrics_raw.strip():
            old = soup.find("div", class_="lyrics")
            if old: lyrics_raw = old.get_text("\n")

        if not lyrics_raw.strip():
            print("PARSING ERROR: LYRICS CONTENT EMPTY.")
            return None

        return {
            "lyrics": clean_lyrics(lyrics_raw),
            "title": title,
            "artist": artist,
            "url": song_url
        }

    except Exception as e:
        print(f"GENIUS SCRAPER CRASH: {e}")
        return None