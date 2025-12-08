import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, 'backend'))

from backend.app.main import app