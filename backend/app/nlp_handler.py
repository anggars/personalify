# di backend/app/nlp_handler.py
import os
import requests

# ▼▼▼ GANTI MODEL KE GoEmotions ▼▼▼
API_URL = "https://api-inference.huggingface.co/models/SamLowe/roberta-base-go_emotions"
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
    if not track_names:
        return "Couldn't analyze music mood."

    text_to_analyze = ". ".join(track_names[:10])
    emotion_data = get_emotion_from_text(text_to_analyze)

    if not emotion_data or not emotion_data[0]:
        return "Having trouble reading music's vibe."

    try:
        # Urutkan dari skor tertinggi ke rendah
        sorted_emotions = sorted(emotion_data[0], key=lambda x: x['score'], reverse=True)
        # Ambil 3 teratas
        top_emotions = sorted_emotions[:3]
    except (IndexError, KeyError):
        return "Could not parse emotion."

    # Mapping kalimat pendek
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

    # Format: "soft sadness, sparked curiosity, neutral balance"
    formatted = ", ".join(
        f"{emotion_texts.get(e['label'], e['label'])}"
        for e in top_emotions
    )

    return f"Shades of {formatted}."
