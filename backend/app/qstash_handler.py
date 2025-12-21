import os
from qstash import QStash, Receiver

def get_qstash_client():
    token = os.getenv("QSTASH_TOKEN")
    if not token:
        print("CRITICAL: QSTASH_TOKEN is MISSING in Env Variables!")
    else:
        print(f"ℹ️ Token Loaded: {token[:5]}...xxx (Length: {len(token)})")
    return QStash(token=token)

def get_qstash_receiver():
    return Receiver(
        current_signing_key=os.getenv("QSTASH_CURRENT_SIGNING_KEY"),
        next_signing_key=os.getenv("QSTASH_NEXT_SIGNING_KEY")
    )