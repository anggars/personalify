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
        return "Your playlist is filled with energetic tunes, reflecting a mood of <b>joy</b>."
    elif emotion_label == 'sadness':
        return "You're in a reflective mood, with music that evokes a sense of <b>sadness</b>."
    elif emotion_label == 'anger':
        return "Your playlist is packed with powerful, high-energy tracks that carry an undercurrent of <b>anger</b>."
    elif emotion_label == 'fear':
        return "You're currently into mysterious and atmospheric sounds that create a feeling of <b>fear</b> or suspense."
    elif emotion_label == 'surprise':
        return "Your current music taste is dynamic and unpredictable, full of <b>surprise</b>."
    elif emotion_label == 'disgust':
        return "You're exploring raw sounds, showing a rebellious <b>disgust</b> for mainstream norms."
    else: # Default untuk 'neutral'
        return "Your music taste appears quite balanced, indicating a <b>neutral</b> emotional state."