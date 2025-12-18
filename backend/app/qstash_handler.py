import os
from qstash import QStash, Receiver

def get_qstash_client():
    return QStash(token=os.getenv("QSTASH_TOKEN"))

def get_qstash_receiver():
    return Receiver(
        current_signing_key=os.getenv("QSTASH_CURRENT_SIGNING_KEY"),
        next_signing_key=os.getenv("QSTASH_NEXT_SIGNING_KEY")
    )