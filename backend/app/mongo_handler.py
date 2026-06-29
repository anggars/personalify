import os
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

_client = None
_db = None

def get_db():
    global _client, _db
    if _db is not None:
        return _db
        
    try:
        if MONGO_URI:
            print(f"MONGO HANDLER: CONNECTING TO CLOUD ATLAS VIA URI.")
            # Set a lower serverSelectionTimeoutMS so it doesn't block forever
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            _db = _client.get_database("personalify_sync_history") 
        else:
            mongo_host = os.getenv("MONGO_HOST", "mangofy")
            mongo_port = int(os.getenv("MONGO_PORT", 27017))
            print(f"MONGO HANDLER: CONNECTING TO LOCAL MONGO AT {mongo_host}:{mongo_port}.")
            _client = MongoClient(mongo_host, mongo_port, serverSelectionTimeoutMS=5000)
            _db = _client["personalify_db"]
    except Exception as e:
        print(f"MONGO HANDLER INIT ERROR: {e}")
        raise e
        
    return _db

def save_user_sync(spotify_id, time_range, data):
    collection = get_db()["user_syncs"]
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
    collection = get_db()["user_syncs"]
    history = collection.find({'spotify_id': spotify_id}, {'_id': 0}).sort('last_synced', -1)
    return list(history)

def get_user_sync(spotify_id, time_range):
    collection = get_db()["user_syncs"]
    return collection.find_one({"spotify_id": spotify_id, "time_range": time_range}, {"_id": 0})

def get_all_synced_user_ids():
    collection = get_db()["user_syncs"]
    return collection.distinct("spotify_id")

def get_active_provider():
    try:
        config = get_db()["AppConfig"].find_one({"_id": "system_config"})
        return config.get("active_provider", "spotify") if config else "spotify"
    except Exception as e:
        print(f"MONGO CONFIG ERROR: {e}")
        return "spotify"

def set_active_provider(provider: str):
    get_db()["AppConfig"].update_one(
        {"_id": "system_config"},
        {"$set": {"active_provider": provider}},
        upsert=True
    )