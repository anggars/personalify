import os
from pymongo import MongoClient

mongo_host = os.getenv("MONGO_HOST", "mangofy")
mongo_port = int(os.getenv("MONGO_PORT", 27017))

client = MongoClient(mongo_host, mongo_port)
db = client["personalify_db"]

def save_user_sync(spotify_id, time_range, data):
    collection = db["user_syncs"]
    collection.update_one(
        {"spotify_id": spotify_id, "time_range": time_range},
        {"$set": {"data": data}},
        upsert=True
    )

def get_user_sync(spotify_id, time_range):
    return db["user_syncs"].find_one({
        "spotify_id": spotify_id,
        "time_range": time_range
    })

def get_user_history(spotify_id):
    return list(collection.find({"spotify_id": spotify_id}, {"_id": 0}))
