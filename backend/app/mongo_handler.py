import os
from pymongo import MongoClient
from datetime import datetime

# --- BLOK KODE BARU ---
# Ambil MONGO_URI dari environment variable.
MONGO_URI = os.getenv("MONGO_URI")

# Pastikan MONGO_URI ada sebelum membuat koneksi.
if not MONGO_URI:
    # Di Render, ini seharusnya tidak pernah terjadi jika env var sudah diatur.
    raise Exception("MONGO_URI environment variable not set.")

client = MongoClient(MONGO_URI)
# Anda bisa tentukan nama database di sini atau langsung dari URI.
# Jika URI Anda sudah mengandung nama database, baris ini bisa dikosongkan.
db = client.get_database("personalify_sync_history") 
# --- AKHIR BLOK KODE BARU ---

def save_user_sync(spotify_id, time_range, data):
    # Membuat koleksi untuk setiap user agar lebih terorganisir
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
    # Mengambil semua histori untuk user tersebut
    history = collection.find({}, {'_id': 0}).sort('last_synced', -1)
    return list(history)

# Anda mungkin perlu fungsi ini juga di masa depan
def get_user_sync(spotify_id, time_range):
    collection = db[spotify_id]
    return collection.find_one({"time_range": time_range}, {"_id": 0})