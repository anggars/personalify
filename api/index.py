import os
import sys

# --- PATH HACK ---
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

# 1. Masukkan root ke path
sys.path.append(root_dir)

# 2. Masukkan folder 'backend' ke path (PENTING!)
# Ini supaya import 'from app.routes ...' di main.py bisa jalan
sys.path.append(os.path.join(root_dir, 'backend'))
# -----------------

# Import app FastAPI
from backend.app.main import app