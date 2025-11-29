import os
import sys

# --- PATH HACK ---
# Menambahkan folder root ke system path agar folder 'backend' bisa di-import
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
sys.path.append(root_dir)
# -----------------

# Import instance 'app' dari FastAPI kamu
from backend.app.main import app