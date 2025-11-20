import os
from pymongo import MongoClient
from datetime import datetime
from dotenv import load_dotenv

# Memuat .env agar tetap berfungsi di lokal
load_dotenv()

# --- BLOK KONEKSI PINTAR ---
MONGO_URI = os.getenv("MONGO_URI")

if MONGO_URI:
    # Jika ada MONGO_URI (saat di Render), gunakan itu
    client = MongoClient(MONGO_URI)
    db = client.get_database("personalify_sync_history") # Nama DB Anda di Atlas
else:
    # Jika tidak ada (saat di lokal), gunakan host dan port dari .env
    mongo_host = os.getenv("MONGO_HOST", "mangofy")
    mongo_port = int(os.getenv("MONGO_PORT", 27017))
    client = MongoClient(mongo_host, mongo_port)
    db = client["personalify_db"] # Nama DB lokal Anda

# --- AKHIR BLOK KONEKSI PINTAR ---


def save_user_sync(spotify_id, time_range, data):
    # Menggunakan koleksi untuk setiap user agar lebih terorganisir
    collection = db[spotify_id]
    collection.update_one(
        {'time_range': time_range},
        {
            '$set': {
                'data': data,
                'last_synced': datetime.utcnow()
            }
        },
        upsert=True
    )

def get_user_history(spotify_id):
    collection = db[spotify_id]
    history = collection.find({}, {'_id': 0}).sort('last_synced', -1)
    return list(history)

def get_user_sync(spotify_id, time_range):
    collection = db[spotify_id]
    return collection.find_one({"time_range": time_range}, {"_id": 0})

def get_all_synced_user_ids():
    """
    Fungsi Python baru untuk mengambil daftar semua user yang
    datanya tersimpan di MongoDB.
    """
    # Di arsitektur Anda, setiap user adalah nama koleksi,
    # jadi kita cukup panggil list_collection_names()
    return db.list_collection_names()