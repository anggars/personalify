import os
import csv
import io
from app.db_handler import get_aggregate_stats, get_user_db_details, get_conn 
from app.mongo_handler import get_all_synced_user_ids 
from app.cache_handler import r as redis_client 

def get_system_wide_stats():
    print("ADMIN_STATS: COLLECTING SYSTEM-WIDE STATISTICS...")

    try:
        db_stats = get_aggregate_stats()
        print(f"ADMIN_STATS: SUCCESSFULLY RETRIEVED DATA FROM POSTGRESQL.")
    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE DATA FROM POSTGRESQL: {e}")
        db_stats = {
            "error_postgres": str(e),
            "total_users": -1,
            "total_unique_artists": -1,
            "total_unique_tracks": -1,
            "most_popular_artists": [],
            "most_popular_tracks": []
        }

    try:
        mongo_users = get_all_synced_user_ids()
        db_stats["mongo_synced_users_count"] = len(mongo_users)
        db_stats["mongo_synced_user_list"] = mongo_users
        print(f"ADMIN_STATS: SUCCESSFULLY RETRIEVED DATA FROM MONGODB.")
    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE DATA FROM MONGODB: {e}")
        db_stats["mongo_synced_users_count"] = -1
        db_stats["mongo_synced_user_list"] = [f"Error: {e}"]

    try:

        redis_keys = redis_client.keys("top:*:*")
        db_stats["redis_cached_keys_count"] = len(redis_keys)

        db_stats["redis_sample_keys"] = redis_keys[:5]

        print(f"ADMIN_STATS: SUCCESSFULLY RETRIEVED DATA FROM REDIS.")
    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE DATA FROM REDIS: {e}")
        db_stats["redis_cached_keys_count"] = -1
        db_stats["redis_sample_keys"] = [f"Error: {e}"]

    print("ADMIN_STATS: DONE COLLECTING SYSTEM-WIDE STATISTICS.")
    return db_stats

def get_user_report(spotify_id: str):
    print(f"ADMIN_STATS: FETCHING REPORT FOR USER: {spotify_id}")
    try:
        user_details = get_user_db_details(spotify_id)
        print(f"ADMIN_STATS: SUCCESSFULLY RETRIEVED DATA FOR USER {spotify_id} FROM POSTGRESQL.")
        return user_details
    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE DATA FOR USER {spotify_id} FROM POSTGRESQL: {e}")
        return {
            "error": str(e),
            "spotify_id": spotify_id,
            "display_name": "N/A",
            "db_top_artists": [],
            "db_top_tracks": []
        }

def export_users_to_csv():
    print("ADMIN: STARTING TO EXPORT USERS DATA (FULL DETAIL MODE)...")

    try:
        output = io.StringIO()
        writer = csv.writer(output)

        with get_conn() as conn:
            with conn.cursor() as cur:

                query = """
                SELECT 
                    u.id, 
                    u.spotify_id, 
                    u.display_name,
                    -- Ambil Top 10 Artis, gabung jadi satu string dipisah koma
                    COALESCE(
                        (SELECT STRING_AGG(a.name, ' | ') 
                         FROM (
                             SELECT ar.name 
                             FROM user_artists ua 
                             JOIN artists ar ON ua.artist_id = ar.id 
                             WHERE ua.spotify_id = u.spotify_id
                             LIMIT 10
                         ) a), 
                    'No Data') as top_artists_list,

                    COALESCE(
                        (SELECT STRING_AGG(t.name, ' | ') 
                         FROM (
                             SELECT tr.name 
                             FROM user_tracks ut 
                             JOIN tracks tr ON ut.track_id = tr.id 
                             WHERE ut.spotify_id = u.spotify_id
                             LIMIT 10
                         ) t), 
                    'No Data') as top_tracks_list

                FROM users u
                ORDER BY u.id ASC;
                """

                cur.execute(query)

                headers = ["ID", "Spotify ID", "Display Name", "Top 10 Artists", "Top 10 Tracks"]
                writer.writerow(headers)

                while True:
                    rows = cur.fetchmany(1000)
                    if not rows:
                        break
                    writer.writerows(rows)

        csv_string = output.getvalue()
        output.close()

        print(f"ADMIN: EXPORT COMPLETED.")
        return csv_string

    except Exception as e:
        print(f"ADMIN: FAILED TO EXPORT CSV: {e}")
        return str(e)