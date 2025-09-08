import os
import requests
from deep_translator import GoogleTranslator

API_URL = "https://api-inference.huggingface.co/models/SamLowe/roberta-base-go_emotions"
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
headers = {"Authorization": f"Bearer {HF_API_KEY}"}

def prepare_text_for_analysis(text: str) -> str:
    """
    Menerjemahkan teks ke Inggris menggunakan deep-translator.
    Library ini lebih tangguh dalam menangani koneksi di environment yang sulit.
    """
    if not text or not text.strip():
        return ""

    try:
        print("Checking language and translating with deep-translator...")
        # Library ini otomatis mendeteksi bahasa sumber (source='auto')
        # dan menerjemahkan ke Inggris (target='en')
        translated_text = GoogleTranslator(source='auto', target='en').translate(text)
        
        if translated_text:
            print(f"Translated text: '{translated_text[:100]}...'")
            return translated_text
        
        # Fallback jika hasil terjemahan kosong
        print("Translation returned empty. Using original text.")
        return text
        
    except Exception as e:
        print(f"An error occurred during translation with deep-translator: {e}. Analyzing original text.")
        return text

def get_emotion_from_text(text):
    if not HF_API_KEY: return None
    try:
        payload = {"inputs": text}
        response = requests.post(API_URL, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error calling Hugging Face API: {e}")
        return None

def analyze_lyrics_emotion(lyrics: str):
    """
    Analisis emosi dari lirik lagu.
    """
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}
        
    if not HF_API_KEY:
        return {"error": "Hugging Face API key not set."}
    
    text_to_analyze = prepare_text_for_analysis(lyrics)

    emotion_data = get_emotion_from_text(text_to_analyze)
    
    if not emotion_data or not emotion_data[0]:
        return {"error": "Failed to analyze emotion from the provided text."}
        
    try:
        sorted_emotions = sorted(emotion_data[0], key=lambda x: x['score'], reverse=True)
        # Filter emosi dengan skor sangat rendah untuk hasil lebih bersih
        top_emotions = [e for e in sorted_emotions if e['score'] > 0.01]
        
        if not top_emotions:
             return {"error": "Could not find significant emotions in the lyrics."}

        return {"emotions": top_emotions}
    except Exception:
        return {"error": "Could not parse the emotion analysis result."}

def generate_emotion_paragraph(track_names):
    if not track_names:
        return "Couldn't analyze music mood."

    text_to_join = ". ".join(track_names[:20])
    text_to_analyze = prepare_text_for_analysis(text_to_join)
    
    emotion_data = get_emotion_from_text(text_to_analyze)

    if not emotion_data or not emotion_data[0]:
        return "Having trouble reading music's vibe."

    try:
        sorted_emotions = sorted(emotion_data[0], key=lambda x: x['score'], reverse=True)
        top_emotions = sorted_emotions[:3]
    except (IndexError, KeyError):
        return "Could not parse emotion."

    emotion_texts = {
        "admiration": "inspiring <b>admiration</b>",
        "amusement": "playful <b>amusement</b>",
        "anger": "intense <b>anger</b>",
        "annoyance": "subtle <b>annoyance</b>",
        "approval": "positive <b>approval</b>",
        "caring": "gentle <b>caring</b>",
        "confusion": "a touch of <b>confusion</b>",
        "curiosity": "sparked <b>curiosity</b>",
        "desire": "yearning <b>desire</b>",
        "disappointment": "quiet <b>disappointment</b>",
        "disapproval": "firm <b>disapproval</b>",
        "disgust": "raw <b>disgust</b>",
        "embarrassment": "awkward <b>embarrassment</b>",
        "excitement": "bright <b>excitement</b>",
        "fear": "whispers of <b>fear</b>",
        "gratitude": "warm <b>gratitude</b>",
        "grief": "heavy <b>grief</b>",
        "joy": "radiant <b>joy</b>",
        "love": "tender <b>love</b>",
        "nervousness": "tense <b>nervousness</b>",
        "optimism": "hopeful <b>optimism</b>",
        "pride": "bold <b>pride</b>",
        "realization": "sudden <b>realization</b>",
        "relief": "soothing <b>relief</b>",
        "remorse": "deep <b>remorse</b>",
        "sadness": "soft <b>sadness</b>",
        "surprise": "unexpected <b>surprise</b>",
        "neutral": "<b>neutral</b> balance"
    }

    formatted = ", ".join(
        f"{emotion_texts.get(e['label'], e['label'])}"
        for e in top_emotions
    )
    return f"Shades of {formatted}."