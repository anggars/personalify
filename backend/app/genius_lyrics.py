import os
import requests
from fastapi import HTTPException

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com"

def genius_headers():
    return {"Authorization": f"Bearer {GENIUS_TOKEN}"}

def search_artist(q: str):
    resp = requests.get(
        f"{GENIUS_API_URL}/search",
        params={"q": q},
        headers=genius_headers()
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Gagal mencari artis")
    results = resp.json()["response"]["hits"]
    artists = []
    seen = set()
    for hit in results:
        artist = hit["result"]["primary_artist"]
        if artist["id"] not in seen:
            artists.append({"id": artist["id"], "name": artist["name"]})
            seen.add(artist["id"])
    return artists

def artist_songs(artist_id: int, max_pages: int = 10):
    songs = []
    page = 1
    while page <= max_pages:
        resp = requests.get(
            f"{GENIUS_API_URL}/artists/{artist_id}/songs",
            params={"per_page": 50, "page": page, "sort": "popularity"},
            headers=genius_headers()
        )
        if resp.status_code != 200:
            break
        data = resp.json()["response"]["songs"]
        if not data:
            break
        for song in data:
            songs.append({
                "id": song["id"],
                "title": song["title"]
            })
        page += 1
    return songs

def song_lyrics(song_id: int):
    resp = requests.get(
        f"{GENIUS_API_URL}/songs/{song_id}",
        headers=genius_headers()
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Gagal mengambil info lagu")
    song_url = resp.json()["response"]["song"]["url"]
    # Scraping lirik dari halaman web Genius
    from bs4 import BeautifulSoup
    html = requests.get(song_url).text
    soup = BeautifulSoup(html, "html.parser")
    lyrics_div = soup.find("div", class_="lyrics")
    if lyrics_div:
        lyrics = lyrics_div.get_text(separator="\n").strip()
    else:
        # Selector baru Genius
        lyrics = ""
        for div in soup.select("div[data-lyrics-container='true']"):
            lyrics += div.get_text(separator="\n")
        lyrics = lyrics.strip()
    if not lyrics:
        raise HTTPException(status_code=404, detail="Lirik tidak ditemukan")
    return {"lyrics": lyrics}
    page = 1
    while page <= max_pages:
        resp = requests.get(
            f"{GENIUS_API_URL}/artists/{artist_id}/albums",
            params={"per_page": 20, "page": page},
            headers=genius_headers()
        )
        if resp.status_code != 200:
            break
        data = resp.json()["response"]["albums"]
        if not data:
            break
        for album in data:
            albums.append({
                "id": album["id"],
                "name": album["name"],
                "cover_art_url": album.get("cover_art_url"),
                "release_date": album.get("release_date"),
                "full_title": album.get("full_title"),
            })
        page += 1
    return albums

def album_songs(album_id: int):
    resp = requests.get(
        f"{GENIUS_API_URL}/albums/{album_id}/tracks",
        headers=genius_headers()
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch album songs")
    tracks = resp.json()["response"]["tracks"]
    songs = []
    for track in tracks:
        song = track["song"]
        songs.append({
            "id": song["id"],
            "title": song["title"]
        })
    return songs

def artist_singles(artist_id: int, max_pages: int = 5):
    singles = []
    page = 1
    while page <= max_pages:
        resp = requests.get(
            f"{GENIUS_API_URL}/artists/{artist_id}/songs",
            params={"per_page": 20, "page": page, "sort": "popularity"},
            headers=genius_headers()
        )
        if resp.status_code != 200:
            break
        data = resp.json()["response"]["songs"]
        if not data:
            break
        for song in data:
            # Jika tidak punya album, berarti single
            if not song.get("album"):
                singles.append({
                    "id": song["id"],
                    "title": song["title"]
                })
        page += 1
    return singles
