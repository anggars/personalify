import os
import csv
import io
from app.db_handler import get_aggregate_stats, get_user_db_details, get_conn 
from app.mongo_handler import get_all_synced_user_ids 
from app.cache_handler import r as redis_client 

import datetime

def get_system_wide_stats():
    print("ADMIN_STATS: COLLECTING SYSTEM-WIDE STATISTICS...")
    
    try:
        from app.db_handler import sync_neon_supabase
        sync_meta = sync_neon_supabase()
        
        db_stats = get_aggregate_stats()
        # Ensure sync_meta is a dict and has default values
        if not isinstance(sync_meta, dict): sync_meta = {}
        
        pushed = sync_meta.get('pushed_to_backup', sync_meta.get('pushed_to_s', 0))
        pulled = sync_meta.get('pulled_from_backup', sync_meta.get('pulled_from_s', 0))
        
        db_stats["sync_summary"] = f"PUSHED: {pushed} | PULLED: {pulled}"
        if sync_meta.get("errors"):
             db_stats["sync_summary"] += f" | ERRORS: {len(sync_meta['errors'])}"
             
        print(f"ADMIN_STATS: SUCCESSFULLY RETRIEVED DATA AND SYNCED.")
    except Exception as e:
        print(f"ADMIN_STATS: FAILED TO RETRIEVE DATA/SYNC: {e}")
        db_stats = {
            "total_users": -1,
            "total_unique_artists": -1,
            "total_unique_tracks": -1,
            "most_popular_artists": [],
            "most_popular_tracks": [],
            "recent_users": [f"Error: {e}"],
            "sync_summary": "SYNC_FAILED"
        }

    try:
        mongo_users = get_all_synced_user_ids()
        db_stats["mongo_synced_users_count"] = len(mongo_users)
        db_stats["mongo_synced_user_list"] = mongo_users
    except Exception as e:
        db_stats["mongo_synced_users_count"] = -1
        db_stats["mongo_synced_user_list"] = []

    try:
        redis_keys = redis_client.keys("top:*:*")
        db_stats["redis_cached_keys_count"] = len(redis_keys)
    except Exception as e:
        db_stats["redis_cached_keys_count"] = -1

    # Format into receipt string
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    RECEIPT_WIDTH = 40

    def format_line(key, value):
        key_str = str(key)
        value_str = str(value)
        padding = RECEIPT_WIDTH - len(key_str) - len(value_str) - 2 - 2
        if padding < 1: padding = 1
        return f" {key_str}{'.' * padding}{value_str} "

    receipt_lines = []
    receipt_lines.append("*" * RECEIPT_WIDTH)
    receipt_lines.append("      PERSONALIFY SYSTEM AUDIT      ")
    receipt_lines.append("*" * RECEIPT_WIDTH)
    receipt_lines.append(f" DATE: {now}")
    receipt_lines.append("=" * RECEIPT_WIDTH)

    receipt_lines.append("\n--- POSTGRESQL (MAIN DB) ---")
    receipt_lines.append(format_line("Total Users", db_stats.get('total_users', 'N/A')))
    receipt_lines.append(format_line("Total Artists", db_stats.get('total_unique_artists', 'N/A')))
    receipt_lines.append(format_line("Total Tracks", db_stats.get('total_unique_tracks', 'N/A')))
    receipt_lines.append(format_line("SYNC_ALIGNMENT", db_stats.get('sync_summary', 'N/A')))

    receipt_lines.append("\n  Registered Users (Postgres):")
    for user in db_stats.get('recent_users', []):
        receipt_lines.append(f"    - {user}")

    receipt_lines.append("\n  Top Artists (All Users):")
    for item in db_stats.get('most_popular_artists', [])[:3]:
        receipt_lines.append(f"    - {item}")

    receipt_lines.append("\n  Top Tracks (All Users):")
    for item in db_stats.get('most_popular_tracks', [])[:3]:
        receipt_lines.append(f"    - {item}")

    receipt_lines.append("\n" + "=" * RECEIPT_WIDTH)
    receipt_lines.append("--- MONGODB (SYNC HISTORY) ---")
    receipt_lines.append(format_line("Synced_User_Count", db_stats.get('mongo_synced_users_count', '0')))
    
    receipt_lines.append("\n  Recently Synced Users:")
    for user_id in db_stats.get('mongo_synced_user_list', [])[:5]:
        receipt_lines.append(f"    - {user_id}")

    receipt_lines.append("\n" + "=" * RECEIPT_WIDTH)
    receipt_lines.append("--- REDIS (CACHE) ---")
    receipt_lines.append(format_line("Active_Cache_Keys", db_stats.get('redis_cached_keys_count', '0')))

    receipt_lines.append("\n" + "*" * RECEIPT_WIDTH)
    receipt_lines.append("         THANK YOU - ADMIN        ")
    receipt_lines.append("*" * RECEIPT_WIDTH)

    print("ADMIN_STATS: DONE COLLECTING SYSTEM-WIDE STATISTICS.")
    return "\n".join(receipt_lines)

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