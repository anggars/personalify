import os
import requests

API_URL = "https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base"
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
headers = {"Authorization": f"Bearer {HF_API_KEY}"}

def get_emotion_from_text(text):
    """Mengirim teks ke Hugging Face dan mendapatkan prediksi emosi."""
    if not HF_API_KEY:
        return None # Lewati jika API key tidak diatur
        
    try:
        response = requests.post(API_URL, headers=headers, json={"inputs": text})
        response.raise_for_status() # Cek jika ada error dari server
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error calling Hugging Face API: {e}")
        return None

def generate_emotion_paragraph(track_names):
    """
    Menganalisis daftar lagu, menemukan emosi dominan, 
    dan membuat paragraf deskriptif.
    """
    if not track_names:
        return "Couldn't analyze your music's mood yet. Listen to more songs!"

    # Gabungkan 10 judul lagu teratas menjadi satu kalimat
    text_to_analyze = ". ".join(track_names[:10])
    
    emotion_data = get_emotion_from_text(text_to_analyze)

    if not emotion_data or not emotion_data[0]:
        return "Having trouble reading your music's vibe right now. Please try again later."
    
    # Cari emosi dengan skor tertinggi
    top_emotion = max(emotion_data[0], key=lambda x: x['score'])
    emotion_label = top_emotion['label']

def generate_emotion_paragraph(track_names):
    """
    Menganalisis daftar lagu, menemukan emosi dominan, 
    dan membuat paragraf deskriptif.
    """
    if not track_names:
        return "Couldn't analyze your music's mood yet."

    text_to_analyze = ". ".join(track_names[:10])
    emotion_data = get_emotion_from_text(text_to_analyze)

    if not emotion_data or not emotion_data[0]:
        return "Having trouble reading your music's vibe right now."
    
    top_emotion = max(emotion_data[0], key=lambda x: x['score'])
    emotion_label = top_emotion['label']

    # --- PARAGRAF DENGAN TAG HTML <b> ---
    if emotion_label == 'joy':
        return "Playlist filled with energetic tunes, reflecting <b>joy</b>."
    elif emotion_label == 'sadness':
        return "Reflective mood with music steeped in <b>sadness</b>."
    elif emotion_label == 'anger':
        return "Playlist packed with powerful, high-energy tracks carrying <b>anger</b>."
    elif emotion_label == 'fear':
        return "Drawn to mysterious and atmospheric sounds creating <b>fear</b> or suspense."
    elif emotion_label == 'surprise':
        return "Dynamic and unpredictable taste, full of <b>surprise</b>."
    elif emotion_label == 'disgust':
        return "Exploring raw sounds with a rebellious <b>disgust</b> for mainstream norms."
    else:  # neutral
        return "Balanced taste indicating a <b>neutral</b> emotional state."
