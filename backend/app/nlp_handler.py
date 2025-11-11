import os
import requests
import time
import re
from deep_translator import GoogleTranslator
from huggingface_hub import InferenceClient # Kita akan pakai ini
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- 1. KONFIGURASI API (WAJIB) ---
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
HF_MODEL = "SamLowe/roberta-base-go_emotions"

# Cek apakah API Key ada
if not HF_API_KEY:
    print("="*50)
    print("WARNING: HUGGING_FACE_API_KEY tidak ditemukan di .env")
    print("Analisis emosi TIDAK AKAN JALAN TANPA API KEY.")
    print("="*50)
    # Kita tetap inisialisasi client, tapi dia akan gagal jika dipanggil
    hf_client = None
else:
    try:
        # Inisialisasi client API (cara modern)
        hf_client = InferenceClient(model=HF_MODEL, token=HF_API_KEY)
        print("NLP Handler: Hugging Face InferenceClient siap.")
    except Exception as e:
        print(f"NLP Handler: GAGAL inisialisasi InferenceClient. Error: {e}")
        hf_client = None

# --- 2. EMOTION TEXTS (TETAP DIPAKAI) ---
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

# Simple in-memory cache
_analysis_cache = {}

# --- 3. FUNGSI TRANSLATOR (TETAP DIPAKAI) ---
def prepare_text_for_analysis(text: str) -> str:
    """
    Menerjemahkan teks non-Inggris ke Inggris menggunakan deep-translator.
    """
    if not text or not text.strip():
        return ""
    try:
        # Cek bahasa dulu
        lang = GoogleTranslator().detect(text[:100]) # Deteksi dari 100 char pertama
        
        if lang == 'en':
            print("NLP Handler: Teks sudah Bahasa Inggris, tidak perlu translate.")
            return text # Langsung kembalikan jika sudah Inggris
            
        print(f"NLP Handler: Menerjemahkan teks dari [{lang}] ke [en]...")
        # (Ini butuh 'pip install deep-translator')
        translated_text = GoogleTranslator(source='auto', target='en').translate(text)
        
        if translated_text:
            print(f"NLP Handler: Hasil translasi: '{translated_text[:100]}...'")
            return translated_text
        
        print("NLP Handler: Translasi gagal, menggunakan teks asli.")
        return text
    except Exception as e:
        print(f"NLP Handler: Error saat translasi: {e}. Menggunakan teks asli.")
        return text

# --- 4. FUNGSI ANALISIS (DIBENERIN & DISIMPLIFY) ---
def get_emotion_from_text(text: str):
    """
    Menganalisis teks menggunakan InferenceClient API.
    Fungsi ini MENGGANTIKAN semua logic API call yang rumit dan error.
    """
    if not hf_client:
        print("NLP Handler: HF Client tidak siap (API Key hilang?). Analisis dibatalkan.")
        return None
    if not text or not text.strip():
        print("NLP Handler: Teks input kosong. Analisis dibatalkan.")
        return None

    # Cek cache dulu
    if text in _analysis_cache:
        print("NLP Handler: Mengambil hasil dari cache.")
        return _analysis_cache[text]

    try:
        print(f"NLP Handler: Memanggil HF InferenceClient untuk model {HF_MODEL}...")
        
        # 'text_classification' mengembalikan list of dicts [[...]]
        # Kita minta 'top_k=28' untuk dapet semua skor
        results = hf_client.text_classification(text[:510], top_k=28) 
        
        # 'results' adalah list of dicts (sudah benar)
        if results and isinstance(results, list):
            _analysis_cache[text] = results # Simpan ke cache
            return results
        else:
            print(f"NLP Handler: Hasil prediksi API tidak terduga: {results}")
            return None

    except Exception as e:
        print(f"NLP Handler: Error saat prediksi API: {e}")
        # Ini bisa jadi karena API key salah atau server HF down
        return None

# --- 5. FUNGSI ANALISIS LIRIK (TETAP DIPAKAI) ---
def analyze_lyrics_emotion(lyrics: str):
    """
    Analisis emosi dari lirik lagu (dipanggil dari /analyze-lyrics).
    """
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}

    # 1. Terjemahkan lirik (jika perlu)
    text = prepare_text_for_analysis(lyrics.strip())
    if not text:
         return {"error": "Translated text is empty."}
         
    # 2. Analisis teks yang sudah diterjemahkan
    emotions = get_emotion_from_text(text)

    if not emotions:
        # Jika API GAGAL (misal API key salah)
        print("NLP Handler: API Gagal, kirim error ke frontend.")
        return {"error": "Emotion analysis is currently unavailable. Check server logs."}

    try:
        # 'emotions' sudah jadi list of dicts
        sorted_emotions = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
        top5 = sorted_emotions[:5]
        out = [{"label": e["label"], "score": float(e.get("score", 0))} for e in top5]
        return {"emotions": out}
    except Exception as e:
        print(f"NLP Handler: Error parsing LOKAL emotions: {e}")
        return {"error": "Error parsing analysis results."}

# --- 6. FUNGSI PARAGRAF DASHBOARD (DIBENERIN BIAR AKURAT) ---
def generate_emotion_paragraph(track_names, extended=False):
    """
    Membuat paragraf "puitis" untuk dashboard.
    INI LOGIKA AKURAT DARI COMMIT LAMA + FIX TRANSLASI.
    """
    if not track_names:
        return "Couldn't analyze music mood."

    # Tentukan jumlah track
    tracks_to_analyze = track_names[:20] if extended else track_names[:10]
    
    # --- INI LOGIKA YANG BENAR (dari commit lama lu) ---
    # Gabungkan semua judul jadi SATU BLOK TEKS
    combined_text = "\n".join(tracks_to_analyze)

    # --- INI BUG FIX PALING PENTING ---
    # 1. Terjemahkan blok teks gabungan (jika perlu)
    # Model 'go_emotions' HANYA ngerti B.Inggris. 
    # Judul "ELEGI" atau "Jauh" harus di-translate!
    text = prepare_text_for_analysis(combined_text)
    if not text:
        return "Vibe analysis failed (empty text)."
    # --- AKHIR BUG FIX ---

    # 2. Analisis teks yang sudah diterjemahkan
    emotions = get_emotion_from_text(text) 

    if not emotions:
        # Jika model LOKAL gagal (atau API Key salah)
        return "Vibe analysis is currently unavailable."

    # --- Bagian format "puitis" (dari file baru lu, udah bener) ---
    try:
        em_list = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
    except Exception:
        return "Vibe analysis failed (parsing error)."

    # Deduplikasi label
    unique = []
    seen = set()
    for e in em_list:
        lbl = e.get("label")
        if not lbl: continue
        if lbl not in seen:
            seen.add(lbl)
            unique.append(e)
            if len(unique) >= 3:
                break
    
    # Padding
    if len(unique) < 3:
        pad_defaults = [
            {"label": "neutral", "score": 0.5},
            {"label": "optimism", "score": 0.3},
            {"label": "joy", "score": 0.2}
        ]
        for p in pad_defaults:
            if p["label"] not in seen:
                unique.append(p); seen.add(p["label"])
                if len(unique) >= 3:
                    break
    
    top3 = unique[:3]

    # Format string (logika ini sudah bagus)
    formatted = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)
    
    # Harusnya sekarang hasilnya 'sadness', 'disappointment', 'neutral'
    # Bukan 'neutral', 'joy', 'sadness'
    
    if extended and len(track_names) > 10:
        return f"Diving deeper into your collection, shades of {formatted}."
    return f"Shades of {formatted}."