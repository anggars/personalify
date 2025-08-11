# di backend/app/nlp_handler.py
import os
import requests

# ▼▼▼ GANTI DENGAN MODEL BARU YANG TERVERIFIKASI ▼▼▼
API_URL = "https://api-inference.huggingface.co/models/bhadresh-savani/bert-base-uncased-emotion"
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
headers = {"Authorization": f"Bearer {HF_API_KEY}"}
# ▲▲▲

def get_emotion_from_text(text):
    """Mengirim teks ke Hugging Face Model API dan mendapatkan prediksi emosi."""
    if not HF_API_KEY:
        return None
        
    try:
        payload = {"inputs": text}
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error calling Hugging Face API: {e}")
        return None

def generate_emotion_paragraph(track_names):
    """
    Menganalisis daftar lagu, menemukan emosi dominan dari model, 
    dan membuat paragraf deskriptif.
    """
    if not track_names:
        return "Couldn't analyze your music's mood yet."

    text_to_analyze = ". ".join(track_names[:10])
    emotion_data = get_emotion_from_text(text_to_analyze)

    if not emotion_data or not emotion_data[0]:
        return "Having trouble reading your music's vibe right now."
    
    try:
        top_emotion = max(emotion_data[0], key=lambda x: x['score'])
        emotion_label = top_emotion['label']
    except (IndexError, KeyError) as e:
        print(f"Error parsing API response: {e}")
        return "Could not parse the emotion from the response."

    # Sesuaikan dengan label dari model ini: sadness, joy, love, anger, fear, surprise
    if emotion_label == 'joy':
        return "Playlist filled with energetic tunes, reflecting <b>joy</b>."
    elif emotion_label == 'sadness':
        return "Reflective mood with music steeped in <b>sadness</b>."
    elif emotion_label == 'anger':
        return "Playlist packed with powerful, high-energy tracks carrying <b>anger</b>."
    elif emotion_label == 'fear':
        return "Mysterious and atmospheric sounds creating <b>fear</b> or suspense."
    elif emotion_label == 'love':
        return "Your playlist has a romantic and affectionate <b>love</b> vibe."
    elif emotion_label == 'surprise':
        return "Dynamic and unpredictable taste, full of <b>surprise</b>."
    else: # Default jika ada label lain
        return f"A unique vibe, best described as <b>{emotion_label}</b>."