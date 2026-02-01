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

    collection = db[spotify_id]
    collection.update_one(
        {'time_range': time_range},
        {
            '$set': {
                'data': data,
                'last_synced': datetime.now(timezone.utc)
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
    return db.list_collection_names()