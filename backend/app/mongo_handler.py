import os
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

if MONGO_URI:

    print(f"MONGO HANDLER: CONNECTING TO CLOUD ATLAS VIA URI.")
    client = MongoClient(MONGO_URI)
    db = client.get_database("personalify_sync_history") 

else:

    mongo_host = os.getenv("MONGO_HOST", "mangofy")
    mongo_port = int(os.getenv("MONGO_PORT", 27017))
    print(f"MONGO HANDLER: CONNECTING TO LOCAL MONGO AT {mongo_host}:{mongo_port}.")
    client = MongoClient(mongo_host, mongo_port)
    db = client["personalify_db"] 

def save_user_sync(spotify_id, time_range, data):
    collection = db["user_syncs"]
    collection.update_one(
        {
            'spotify_id': spotify_id,
            'time_range': time_range
        },
        {
            '$set': {
                'data': data,
                'last_synced': datetime.now(timezone.utc)
            }
        },
        upsert=True
    )

def get_user_history(spotify_id):
    collection = db["user_syncs"]
    history = collection.find({'spotify_id': spotify_id}, {'_id': 0}).sort('last_synced', -1)
    return list(history)

def get_user_sync(spotify_id, time_range):
    collection = db["user_syncs"]
    return collection.find_one({"spotify_id": spotify_id, "time_range": time_range}, {"_id": 0})

def get_all_synced_user_ids():
    collection = db["user_syncs"]
    return collection.distinct("spotify_id")

def get_active_provider():
    try:
        config = db["AppConfig"].find_one({"_id": "system_config"})
        return config.get("active_provider", "spotify") if config else "spotify"
    except Exception as e:
        print(f"MONGO CONFIG ERROR: {e}")
        return "spotify"

def set_active_provider(provider: str):
    db["AppConfig"].update_one(
        {"_id": "system_config"},
        {"$set": {"active_provider": provider}},
        upsert=True
    )