import os
from qstash import QStash, Receiver

def get_qstash_client():
    token = os.getenv("QSTASH_TOKEN")
    if not token:
        print("CRITICAL: QSTASH_TOKEN is MISSING in Env Variables!")
    else:
        print(f"Token Loaded: {token[:5]}...xxx (Length: {len(token)})")
    return QStash(token=token)

def get_qstash_receiver():
    return Receiver(
        current_signing_key=os.getenv("QSTASH_CURRENT_SIGNING_KEY"),
        next_signing_key=os.getenv("QSTASH_NEXT_SIGNING_KEY")
    )

def publish_to_qstash(target_path: str, data: dict):
    """
    Helper to publish a job to QStash with signature verification in target endpoint.
    """
    import requests
    import json
    
    app_url = os.getenv("APP_URL", "http://127.0.0.1:8000")
    token = os.getenv("QSTASH_TOKEN")
    
    if "127.0.0.1" in app_url or "localhost" in app_url:
        print(f"QSTASH: Local/Dev Mode. Skipping QStash for {target_path}")
        return False
        
    if not token:
        print(f"QSTASH: ERROR! Token missing for {target_path}")
        return False
        
    target_url = f"{app_url}{target_path}"
    qstash_url = f"https://qstash.upstash.io/v2/publish/{target_url}"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        # Use json= instead of manually dumping to ensure requests handles headers/body encoding
        res = requests.post(qstash_url, headers=headers, json=data, timeout=10)
        if res.status_code < 300:
            print(f"QSTASH: Task queued successfully for {target_path}")
            return True
        else:
            print(f"QSTASH: API REJECTED ({res.status_code}): {res.text}")
            return False
    except Exception as e:
        print(f"QSTASH: Connection error: {e}")
        return False