import os
import requests
import time
import re
from deep_translator import GoogleTranslator
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
HF_MODEL = "SamLowe/roberta-base-go_emotions"

if not HF_API_KEY:
    print("="*50)
    print("WARNING: HUGGING_FACE_API_KEY tidak ditemukan di .env")
    print("Analisis emosi TIDAK AKAN JALAN TANPA API KEY.")
    print("="*50)
    hf_client = None
else:
    try:
        hf_client = InferenceClient(model=HF_MODEL, token=HF_API_KEY)
        print("NLP Handler: Hugging Face InferenceClient siap.")
    except Exception as e:
        print(f"NLP Handler: GAGAL inisialisasi InferenceClient. Error: {e}")
        hf_client = None

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
    "disappointment": "quiet <b>letdown</b>",
    "disapproval": "firm <b>dislike</b>",
    "disgust": "raw <b>disgust</b>",
    "embarrassment": "awkward <b>unease</b>",
    "excitement": "bright <b>excitement</b>",
    "fear": "whispers of <b>fear</b>",
    "gratitude": "warm <b>gratitude</b>",
    "grief": "heavy <b>grief</b>",
    "joy": "radiant <b>joy</b>",
    "love": "tender <b>love</b>",
    "nervousness": "tense <b>anxiety</b>",
    "optimism": "hopeful <b>optimism</b>",
    "pride": "bold <b>pride</b>",
    "realization": "sudden <b>insight</b>",
    "relief": "soothing <b>relief</b>",
    "remorse": "deep <b>regret</b>",
    "sadness": "soft <b>sadness</b>",
    "surprise": "unexpected <b>surprise</b>",
    "neutral": "a <b>neutral</b> state"
}

_analysis_cache = {}

def prepare_text_for_analysis(text: str) -> str:
    """
    Menerjemahkan teks non-Inggris ke Inggris menggunakan deep-translator.
    FIXED: Error handling yang lebih robust.
    """
    if not text or not text.strip():
        print("NLP Handler: Teks kosong, tidak ada yang diterjemahkan.")
        return ""
    
    try:
        # Cek apakah teks sudah bahasa Inggris
        # Gunakan sample text yang lebih panjang untuk deteksi yang akurat
        sample_text = text[:200] if len(text) > 200 else text
        
        try:
            detected_lang = GoogleTranslator().detect(sample_text)
            print(f"NLP Handler: Bahasa terdeteksi: [{detected_lang}]")
        except Exception as detect_error:
            print(f"NLP Handler: Error deteksi bahasa: {detect_error}. Asumsikan bukan Inggris.")
            detected_lang = 'unknown'
        
        # Jika sudah Inggris, langsung return
        if detected_lang == 'en':
            print("NLP Handler: Teks sudah Bahasa Inggris, tidak perlu translate.")
            return text
        
        # Jika bukan Inggris, coba terjemahkan
        print(f"NLP Handler: Menerjemahkan dari [{detected_lang}] ke [en]...")
        
        try:
            translator = GoogleTranslator(source='auto', target='en')
            translated_text = translator.translate(text)
            
            if translated_text and len(translated_text.strip()) > 0:
                print(f"NLP Handler: Berhasil menerjemahkan. Preview: '{translated_text[:100]}...'")
                return translated_text
            else:
                print("NLP Handler: Hasil translasi kosong. Gunakan teks asli.")
                return text
                
        except Exception as translate_error:
            print(f"NLP Handler: Error saat translasi: {translate_error}. Gunakan teks asli.")
            return text
            
    except Exception as e:
        print(f"NLP Handler: Error umum pada prepare_text_for_analysis: {e}")
        print("NLP Handler: Menggunakan teks asli sebagai fallback.")
        return text

def get_emotion_from_text(text: str):
    """
    Menganalisis teks menggunakan InferenceClient API.
    """
    if not hf_client:
        print("NLP Handler: HF Client tidak siap. Analisis dibatalkan.")
        return None
    if not text or not text.strip():
        print("NLP Handler: Teks input kosong. Analisis dibatalkan.")
        return None

    # Cek cache
    if text in _analysis_cache:
        print("NLP Handler: Mengambil hasil dari cache.")
        return _analysis_cache[text]

    try:
        print(f"NLP Handler: Memanggil HF API untuk analisis...")
        
        # Batasi panjang teks ke 510 karakter untuk model
        text_to_analyze = text[:510]
        
        results = hf_client.text_classification(text_to_analyze, top_k=28)
        
        if results and isinstance(results, list):
            print(f"NLP Handler: Berhasil. Top emotion: {results[0]['label']} ({results[0]['score']:.3f})")
            _analysis_cache[text] = results
            return results
        else:
            print(f"NLP Handler: Format hasil tidak terduga: {results}")
            return None

    except Exception as e:
        print(f"NLP Handler: Error API call: {e}")
        return None

def analyze_lyrics_emotion(lyrics: str):
    """
    Analisis emosi dari lirik lagu.
    """
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}

    # Terjemahkan jika perlu
    text = prepare_text_for_analysis(lyrics.strip())
    
    if not text or len(text.strip()) == 0:
        print("NLP Handler: Teks hasil translasi kosong.")
        return {"error": "Translation resulted in empty text."}
    
    # Analisis
    emotions = get_emotion_from_text(text)

    if not emotions:
        print("NLP Handler: API gagal atau tidak ada hasil.")
        return {"error": "Emotion analysis is currently unavailable. Check server logs."}

    try:
        sorted_emotions = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
        top5 = sorted_emotions[:5]
        out = [{"label": e["label"], "score": float(e.get("score", 0))} for e in top5]
        return {"emotions": out}
    except Exception as e:
        print(f"NLP Handler: Error parsing results: {e}")
        return {"error": "Error parsing analysis results."}

def generate_emotion_paragraph(track_names, extended=False):
    """
    Membuat paragraf emosi dari daftar judul lagu.
    FIXED: Sekarang support parameter 'extended'.
    """
    if not track_names:
        return "Couldn't analyze music mood."

    # Gunakan jumlah yang sesuai
    num_tracks = len(track_names) if extended else min(10, len(track_names))
    tracks_to_analyze = track_names[:num_tracks]
    
    print(f"NLP Handler: Menganalisis {num_tracks} lagu (extended={extended})")
    
    # Gabungkan judul
    combined_text = "\n".join(tracks_to_analyze)
    
    # CRITICAL: Terjemahkan dulu
    text = prepare_text_for_analysis(combined_text)
    
    if not text or len(text.strip()) == 0:
        print("NLP Handler: Teks untuk analisis kosong setelah translasi.")
        return "Vibe analysis failed (empty text after translation)."
    
    # Analisis
    emotions = get_emotion_from_text(text)

    if not emotions:
        return "Vibe analysis is currently unavailable."

    try:
        em_list = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
    except Exception:
        return "Vibe analysis failed (parsing error)."

    # Deduplikasi dan ambil top 3
    unique = []
    seen = set()
    for e in em_list:
        lbl = e.get("label")
        if not lbl:
            continue
        if lbl not in seen:
            seen.add(lbl)
            unique.append(e)
            if len(unique) >= 3:
                break
    
    # Padding jika kurang dari 3
    if len(unique) < 3:
        pad_defaults = [
            {"label": "neutral", "score": 0.5},
            {"label": "optimism", "score": 0.3},
            {"label": "joy", "score": 0.2}
        ]
        for p in pad_defaults:
            if p["label"] not in seen:
                unique.append(p)
                seen.add(p["label"])
                if len(unique) >= 3:
                    break
    
    top3 = unique[:3]
    formatted = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)
    
    # Pesan berbeda untuk extended
    if extended and num_tracks > 10:
        return f"Diving deeper into your collection, shades of {formatted}."
    
    return f"Shades of {formatted}."