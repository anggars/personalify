import os
import requests
import json
import re
from dotenv import load_dotenv
try:
    from deep_translator import GoogleTranslator
    HAS_TRANSLATOR = True
except ImportError:
    HAS_TRANSLATOR = False
    print("NLP HANDLER: deep-translator not found. Translation disabled.")

from huggingface_hub import InferenceClient

load_dotenv()

HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
SPACE_URL = "https://anggars-personalify.hf.space/predict"
MODEL_ROBERTA = "SamLowe/roberta-base-go_emotions"
MODEL_DISTILBERT = "joeddav/distilbert-base-uncased-go-emotions-student"

# Initialize HF Client for Fallback
if HF_API_KEY:
    try:
        hf_client = InferenceClient(token=HF_API_KEY, timeout=5.0)
        print("NLP HANDLER: FALLBACK CLIENT READY.")
    except Exception as e:
        print(f"NLP HANDLER: FALLBACK CLIENT INIT FAILED: {e}")
        hf_client = None
else:
    hf_client = None

# --- SLANG DICTIONARY (Shared with Streamlit) ---
SLANG_MAP = {
    # SUNDANESE
    "aing": "saya", "abdi": "saya", "urang": "saya",
    "maneh": "kamu", "anjeun": "kamu", "sia": "kamu",
    "teuing": "tidak tahu", "duka": "tidak tahu",
    "rieut": "pusing", "mumet": "pusing",
    "hayam": "ayam", "naon": "apa",
    "atuh": "dong", "sok": "silakan",
    "mangga": "silakan", "punten": "permisi",
    "nuhun": "terima kasih", "hatur nuhun": "terima kasih",
    "geulis": "cantik", "kasep": "ganteng",
    "nyaah": "sayang", "cinta": "cinta", "bogoh": "cinta",
    "wae": "saja", "hungkul": "saja",
    "lieur": "bingung", "sare": "tidur",
    "dahar": "makan", "nyatu": "makan",
    "kumaha": "bagaimana", "damang": "sehat",
    "bageur": "baik", "bager": "baik",
    "gelo": "gila", "edan": "gila",
    
    # INDO SLANG
    "ngab": "bang", "gan": "bang", "brow": "bang",
    "goks": "keren", "gokil": "keren", "mantul": "mantap",
    "anjay": "wow", "anjir": "wow", "anjay mabar": "wow main bareng",
    "kuy": "ayo", "skuy": "ayo", "gas": "ayo",
    "ygy": "ya guys ya", "tbh": "jujur",
    "idk": "tidak tahu", "cmiiw": "koreksi jika salah",
    "mager": "malas", "baper": "terbawa perasaan",
    "gabut": "bosan", "halu": "khayal",
    "fomo": "ikut-ikutan", "kepo": "penasaran",
    "santuy": "santai", "sans": "santai",
    "gercep": "cepat", "sat set": "cepat",
    "bestie": "sahabat", "besti": "sahabat",
    "kzl": "kesal", "sebel": "kesal", "bt": "kesal",
    "wkwk": "haha", "wkwkwk": "haha",
    "hiks": "sedih", "huft": "lelah",
    "cape": "lelah", "capek": "lelah",
    "tolol": "bodoh", "bego": "bodoh", "goblok": "bodoh"
}

def normalize_slang(text):
    if not text: return ""
    lines = text.split('\n')
    normalized_lines = []
    
    for line in lines:
        words = line.split()
        normalized_words = []
        for word in words:
            clean_word = re.sub(r'[^\w\s]', '', word).lower()
            if clean_word in SLANG_MAP:
                 replacement = SLANG_MAP[clean_word]
                 if word and word[0].isupper(): replacement = replacement.capitalize()
                 normalized_words.append(replacement)
            else:
                 normalized_words.append(word)
        normalized_lines.append(" ".join(normalized_words))
        
    return "\n".join(normalized_lines)

emotion_texts = {
    "admiration": "inspiring <b>admiration</b>",
    "amusement": "playful <b>amusement</b>",
    "anger": "intense <b>anger</b>",
    "annoyance": "subtle <b>annoyance</b>",
    "approval": "positive <b>approval</b>",
    "caring": "gentle <b>caring</b>",
    "confusion": "hazy <b>confusion</b>",
    "curiosity": "sparked <b>curiosity</b>",
    "desire": "yearning <b>desire</b>",
    "disappointment": "quiet <b>letdown</b>",
    "disapproval": "firm <b>dislike</b>",
    "disgust": "raw <b>disgust</b>",
    "embarrassment": "awkward <b>unease</b>",
    "excitement": "bright <b>excitement</b>",
    "fear": "cold <b>fear</b>",
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
    "surprise": "pure <b>surprise</b>",
    "def": "neutral <b>vibe</b>"
}

_analysis_cache = {}

def prepare_text_for_analysis(text: str) -> str:
    """
    Membersihkan, menormalisasi slang, dan MENTERJEMAHKAN ke Inggris
    agar model backend lebih akurat.
    """
    if not text or not text.strip():
        return ""

    # 1. Truncate
    MAX_CHARS = 2500
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    
    # 2. Normalize Slang
    normalized = normalize_slang(text)
    
    # 3. Translate to English
    if HAS_TRANSLATOR:
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Use deep-translator (GoogleTranslator)
                translator = GoogleTranslator(source='auto', target='en')
                translated = translator.translate(normalized)
                
                print(f"NLP HANDLER: TRANSLATION: '{normalized[:30]}...' -> '{translated[:30]}...'")
                return translated
            except Exception as e:
                if attempt < max_retries - 1:
                    sleep_time = 1 * (attempt + 1)
                    print(f"NLP HANDLER: TRANSLATION RETRY {attempt+1}/{max_retries} ({e})... SLEEP {sleep_time}s")
                    time.sleep(sleep_time)
                else:
                    print(f"NLP HANDLER: TRANSLATION FAILED AFTER RETRIES ({e}). USING ORIGINAL.")
                    return normalized
    else:
        return normalized

def _run_fallback_hybrid_analysis(text: str):
    """
    Fallback method: Uses generic HF Inference API with SamLowe + Joeddav
    Called when the Custom Space is sleeping/down.
    """
    if not hf_client:
        print("NLP HANDLER: FALLBACK FAILED - CLIENT NOT READY.")
        return None
        
    print(f"NLP HANDLER: RUNNING FALLBACK HYBRID ANALYSIS (ROBERTA + DISTILBERT)...")
    
    try:
        combined_scores = {}
        successful_models = 0
        
        # Truncate strictly for inference API
        valid_text = text[:1200]

        # 1. Try RoBERTa (SamLowe)
        try:
            print(" > Fallback: Calling RoBERTa (SamLowe)...")
            results_roberta = hf_client.text_classification(valid_text, model=MODEL_ROBERTA, top_k=28)
            for item in results_roberta:
                label = item['label']
                score = item['score']
                combined_scores[label] = combined_scores.get(label, 0) + score
            successful_models += 1
        except Exception as e:
             print(f"NLP HANDLER: Fallback RoBERTa Failed: {e}")

        # 2. Try DistilBERT (Joeddav)
        try:
            print(" > Fallback: Calling DistilBERT (Joeddav)...")
            results_distilbert = hf_client.text_classification(valid_text, model=MODEL_DISTILBERT, top_k=28)
            for item in results_distilbert:
                label = item['label']
                score = item['score']
                combined_scores[label] = combined_scores.get(label, 0) + score
            successful_models += 1
        except Exception as e:
             print(f"NLP HANDLER: Fallback DistilBERT Failed: {e}")

        if successful_models == 0:
             print("NLP HANDLER: ALL FALLBACK MODELS FAILED.")
             return None

        if 'neutral' in combined_scores:
            del combined_scores['neutral']
        
        total = sum(combined_scores.values())
        final_results = []
        if total > 0:
            for label, raw_sum in combined_scores.items():
                final_results.append({"label": label, "score": raw_sum / total})
        
        final_results.sort(key=lambda x: x['score'], reverse=True)
        return final_results

    except Exception as e:
        print(f"NLP HANDLER: FALLBACK CRITICAL ERROR: {e}")
        return None

def get_emotion_from_text(text: str):
    """
    Mengirim request ke HF Space pribadi. 
    JIKA GAGAL (Sleeping/Timeout), OTOMATIS SWICTH KE HYBRID (Fallback).
    """
    if not text or not text.strip():
        return None

    # Check cache
    if text in _analysis_cache:
        print("NLP HANDLER: FETCHING RESULT FROM CACHE.")
        return _analysis_cache[text]

    print(f"NLP HANDLER: CALLING HF SPACE API ({SPACE_URL})...")
    payload = {"text": text}
    headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
    
    try:
        # Short timeout (5s) to detect 'sleeping' state quickly
        response = requests.post(SPACE_URL, json=payload, headers=headers, timeout=5)
        
        if response.status_code == 200:
            result = response.json()
            emotions = []
            if isinstance(result, list): emotions = result
            elif isinstance(result, dict) and "emotions" in result: emotions = result["emotions"]
            else: raise ValueError("Unknown response format")

            # --- STRICT FILTER: REMOVE NEUTRAL & RENORMALIZE ---
            # User Request: "netral buang biar score ga kehalang"
            filtered = [e for e in emotions if e.get('label', '').lower() != 'neutral']
            
            # Re-normalize scores
            total_score = sum(e.get('score', 0) for e in filtered)
            if total_score > 0:
                for e in filtered:
                    e['score'] = e.get('score', 0) / total_score
            
            filtered.sort(key=lambda x: x.get('score', 0), reverse=True)
            _analysis_cache[text] = filtered
            return filtered
        else:
            print(f"NLP HANDLER: SPACE ERROR {response.status_code}. SWITCHING TO BACKUP...")
            raise Exception(f"Space Error {response.status_code}")

    except Exception as e:
        print(f"NLP HANDLER: SPACE FAILED ({e}). ACTIVATING FALLBACK PROTOCOL...")
        # --- ACTIVATE FALLBACK ---
        fallback_result = _run_fallback_hybrid_analysis(text)
        if fallback_result:
            _analysis_cache[text] = fallback_result
            return fallback_result
        else:
            return None

def analyze_lyrics_emotion(lyrics: str):
    """
    Wrapper utama yang digunakan oleh module lain.
    """
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}

    text = prepare_text_for_analysis(lyrics.strip())
    
    emotions = get_emotion_from_text(text)

    if not emotions:
        print("NLP HANDLER: API FAILED OR NO RESULTS.")
        return {"error": "Emotion analysis is currently unavailable."}

    try:
        # Filter out 'neutral' as requested
        filtered_emotions = [e for e in emotions if e.get('label', '').lower() != 'neutral']
        
        # Log all results in single print statement with newlines
        results_lines = "\n".join([f"{e.get('label')}: {float(e.get('score', 0)):.4f}" for e in filtered_emotions])
        print(f"NLP HANDLER: ANALYSIS RESULT (All):\n{results_lines}")

        # Return top 5 for frontend
        top5 = filtered_emotions[:5]
        # Ensure floats
        out = [{"label": e["label"], "score": float(e.get("score", 0))} for e in top5]
        return {"emotions": out}
    except Exception as e:
        print(f"NLP HANDLER: ERROR PARSING RESULTS: {e}")
        return {"error": "Error parsing analysis results."}

def generate_emotion_paragraph(track_names, extended=False):
    """
    Digunakan untuk playlist/album summary.
    """
    if not track_names:
        return "Couldn't analyze music mood.", []

    import concurrent.futures

    num_tracks = len(track_names) if extended else min(10, len(track_names))
    tracks_to_analyze = track_names[:num_tracks]

    print(f"NLP HANDLER: ANALYZING {num_tracks} TRACKS PARALLEL (Voting System / Frequency Count)")

    voting_tally = {}
    total_valid_songs = 0
    
    print(f"NLP HANDLER: ANALYZING {num_tracks} TRACKS SEQUENTIALLY (Voting System - Reliable Mode)")

    voting_tally = {}
    total_valid_songs = 0
    
    # Process tracks one by one to ensure stability (slow but accurate)
    for i, track in enumerate(tracks_to_analyze):
        try:
            # print(f"NLP HANDLER: Processing Track {i+1}: '{track}'...")
            txt = prepare_text_for_analysis(track)
            
            if not txt: continue
            
            emotions = get_emotion_from_text(txt)
            
            if emotions and len(emotions) > 0:
                # VOTING SYSTEM: Find the first NON-NEUTRAL emotion
                selected_emotion = None
                
                for em in emotions:
                    if em.get("label") != 'neutral':
                        selected_emotion = em
                        break
                
                if selected_emotion:
                    lbl = selected_emotion.get("label")
                    voting_tally[lbl] = voting_tally.get(lbl, 0) + 1
                    total_valid_songs += 1
                        
        except Exception as exc:
            print(f"NLP HANDLER: Track '{track}' analysis failed (EXCEPTION): {exc}")

    # print(f"NLP HANDLER: Final Tally: {voting_tally}")

    if total_valid_songs == 0:
        return "No clear vibe detected.", []

    # Sort by VOTE COUNT (Most Frequent)
    sorted_votes = sorted(voting_tally.items(), key=lambda x: x[1], reverse=True)
    
    # Get top 3
    top3_tuples = sorted_votes[:3]
    
    # Format: Score becomes percentage of songs (Votes / Total Songs)
    top3 = [{"label": lbl, "score": count / total_valid_songs} for lbl, count in top3_tuples]

    # NO MORE PADDING WITH FAKE HAPPY EMOTIONS
    # If we only found 1 emotion, just show that 1. Don't lie.
    
    formatted = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)

    return f"Shades of {formatted}.", top3
    
    # Format back to list of dicts for consistency
    top3 = [{"label": lbl, "score": sc} for lbl, sc in top3_tuples]

    # Fill if needed (less than 3 emotions found)
    if len(top3) < 3:
        existing_labels = set(e["label"] for e in top3)
        pad_defaults = [
            {"label": "optimism", "score": 0.1},
            {"label": "joy", "score": 0.1},
            {"label": "sadness", "score": 0.1} 
        ]
        for p in pad_defaults:
            if p["label"] not in existing_labels:
                top3.append(p)
                existing_labels.add(p["label"])
                if len(top3) >= 3:
                    break
    
    formatted = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)

    return f"Shades of {formatted}.", top3


# ==========================================
#  LEGACY NLP HANDLER (BACKUP / REFERENCE)
#  (Local Inference with multiple models)
# ==========================================
"""
import os
import requests
import time
import re
from deep_translator import GoogleTranslator
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
MODEL_ROBERTA = "SamLowe/roberta-base-go_emotions"
MODEL_DISTILBERT = "joeddav/distilbert-base-uncased-go-emotions-student"

if not HF_API_KEY:
    print("="*50)
    print("WARNING: HUGGING_FACE_API_KEY NOT FOUND.")
    print("="*50)
    hf_client = None
else:
    try:
        # TIMEOUT ADDED: Fail fast (5s) so we can switch to backup model quickly
        hf_client = InferenceClient(token=HF_API_KEY, timeout=5.0)
        print("NLP HANDLER: HUGGING FACE INFERENCE CLIENT READY (Timeout=5s).")
    except Exception as e:
        print(f"NLP HANDLER: FAILED TO INITIALIZE CLIENT. ERROR: {e}")
        hf_client = None

emotion_texts = {
    "admiration": "inspiring <b>admiration</b>",
    "amusement": "playful <b>amusement</b>",
    "anger": "intense <b>anger</b>",
    "annoyance": "subtle <b>annoyance</b>",
    "approval": "positive <b>approval</b>",
    "caring": "gentle <b>caring</b>",
    "confusion": "hazy <b>confusion</b>",
    "curiosity": "sparked <b>curiosity</b>",
    "desire": "yearning <b>desire</b>",
    "disappointment": "quiet <b>letdown</b>",
    "disapproval": "firm <b>dislike</b>",
    "disgust": "raw <b>disgust</b>",
    "embarrassment": "awkward <b>unease</b>",
    "excitement": "bright <b>excitement</b>",
    "fear": "cold <b>fear</b>",
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
    "surprise": "pure <b>surprise</b>",
}

_analysis_cache = {}

def prepare_text_for_analysis(text: str) -> str:
    if not text or not text.strip():
        print("NLP HANDLER: EMPTY TEXT, NOTHING TO TRANSLATE.")
        return ""

    try:
        if len(text) > 4500:
            print(f"NLP HANDLER: TEXT TOO LONG ({len(text)} chars). COMPRESSING BEFORE TRANSLATE...")
            lines = text.split('\\n')
            unique_lines = []
            seen = set()
            current_len = 0
            
            for line in lines:
                clean = line.strip()
                if not clean or clean in seen or (clean.startswith('[') and clean.endswith(']')):
                    continue
                if current_len + len(clean) > 3000:
                    break
                
                seen.add(clean)
                unique_lines.append(clean)
                current_len += len(clean) + 1
            
            text = "\\n".join(unique_lines)
            print(f"NLP HANDLER: COMPRESSED TO {len(text)} CHARS.")

        print(f"NLP HANDLER: TRANSLATING TO ENGLISH...")
        try:
            translator = GoogleTranslator(source='auto', target='en')
            translated_text = translator.translate(text)

            if translated_text and len(translated_text.strip()) > 0:
                # Debug dikit biar tau hasilnya
                print(f"NLP HANDLER: TRANSLATED SAMPLE: {translated_text[:100]}...")
                return translated_text
            else:
                print("NLP HANDLER: TRANSLATION RESULTED IN EMPTY TEXT. USING COMPRESSED ORIGINAL.")
                return text

        except Exception as translate_error:
            print(f"NLP HANDLER: TRANSLATION ERROR: {translate_error}. USING COMPRESSED ORIGINAL.")
            return text

    except Exception as e:
        print(f"NLP HANDLER: GENERAL ERROR: {e}")
        return text

def get_emotion_from_text(text: str):
    if not hf_client:
        print("NLP HANDLER: HF CLIENT NOT READY.")
        return None
    if not text or not text.strip():
        return None

    if text in _analysis_cache:
        print("NLP HANDLER: FETCHING RESULT FROM CACHE.")
        return _analysis_cache[text]

    try:
        print(f"NLP HANDLER: RUNNING HYBRID ANALYSIS (ROBERTA + DISTILBERT)...")
        lines = text.split('\\n')
        unique_lines = []
        seen = set()
        current_length = 0
        SAFE_LIMIT = 1200 

        for line in lines:
            clean_line = line.strip()
            if not clean_line or clean_line in seen or (clean_line.startswith('[') and clean_line.endswith(']')):
                continue
            
            if current_length + len(clean_line) > SAFE_LIMIT:
                break
                
            seen.add(clean_line)
            unique_lines.append(clean_line)
            current_length += len(clean_line) + 2

        text_to_analyze = ". ".join(unique_lines)
        
        if len(text_to_analyze) > SAFE_LIMIT:
             text_to_analyze = text_to_analyze[:SAFE_LIMIT]

        print(f"NLP HANDLER: COMPRESSED TEXT LENGTH: {len(text_to_analyze)} chars")

        combined_scores = {}
        successful_models = 0

        # 1. Try RoBERTa (SamLowe)
        try:
            print(" > Calling RoBERTa (SamLowe)...")
            results_roberta = hf_client.text_classification(text_to_analyze, model=MODEL_ROBERTA, top_k=28)
            for item in results_roberta:
                label = item['label']
                score = item['score']
                combined_scores[label] = combined_scores.get(label, 0) + score
            successful_models += 1
        except Exception as e_roberta:
             print(f"⚠️ NLP HANDLER: RoBERTa Failed (Skipping): {e_roberta}")

        # 2. Try DistilBERT (Joeddav)
        try:
            print(" > Calling DistilBERT (Joeddav)...")
            results_distilbert = hf_client.text_classification(text_to_analyze, model=MODEL_DISTILBERT, top_k=28)
            for item in results_distilbert:
                label = item['label']
                score = item['score']
                combined_scores[label] = combined_scores.get(label, 0) + score
            successful_models += 1
        except Exception as e_bert:
             print(f"NLP HANDLER: DistilBERT Failed (Skipping): {e_bert}")

        if successful_models == 0:
             print("NLP HANDLER: BOTH MODELS FAILED.")
             return None

        if 'neutral' in combined_scores:
            del combined_scores['neutral']
        total_remaining = sum(combined_scores.values())

        final_results = []
        if total_remaining > 0:
            for label, raw_sum in combined_scores.items():
                normalized_score = raw_sum / total_remaining
                final_results.append({"label": label, "score": normalized_score})
        else:
            final_results = []

        final_results.sort(key=lambda x: x['score'], reverse=True)

        log_str = "\\n".join([f"{res['label']}: {res['score']:.2%}" for res in final_results])
        print(f"NLP HANDLER: HYBRID RESULT (ALL) ->\\n{log_str}")

        _analysis_cache[text] = final_results
        return final_results

    except Exception as e:
        print(f"NLP HANDLER: ERROR DURING HYBRID ANALYSIS: {e}")
        return None

def analyze_lyrics_emotion(lyrics: str):
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}

    text = prepare_text_for_analysis(lyrics.strip())

    if not text or len(text.strip()) == 0:
        print("NLP HANDLER: TRANSLATION RESULTED IN EMPTY TEXT.")
        return {"error": "Translation resulted in empty text."}

    emotions = get_emotion_from_text(text)

    if not emotions:
        print("NLP HANDLER: API FAILED OR NO RESULTS.")
        return {"error": "Emotion analysis is currently unavailable. Check server logs."}

    try:
        top5 = emotions[:5]
        out = [{"label": e["label"], "score": float(e.get("score", 0))} for e in top5]
        return {"emotions": out}
    except Exception as e:
        print(f"NLP HANDLER: ERROR PARSING RESULTS: {e}")
        return {"error": "Error parsing analysis results."}

def generate_emotion_paragraph(track_names, extended=False):
    if not track_names:
        return "Couldn't analyze music mood.", []

    num_tracks = len(track_names) if extended else min(10, len(track_names))
    tracks_to_analyze = track_names[:num_tracks]

    print(f"NLP HANDLER: ANALYZING {num_tracks} TRACKS (EXTENDED={extended})")

    combined_text = "\\n".join(tracks_to_analyze)
    text = prepare_text_for_analysis(combined_text)

    if not text or len(text.strip()) == 0:
        print("NLP HANDLER: TEXT FOR ANALYSIS EMPTY AFTER TRANSLATION.")
        return "Vibe analysis failed (empty text after translation).", []

    emotions = get_emotion_from_text(text)

    if not emotions:
        return "Vibe analysis is currently unavailable.", []

    try:
        em_list = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
    except Exception:
        return "Vibe analysis failed (parsing error).", []

    unique = []
    seen = set()
    for e in em_list:
        lbl = e.get("label")
        if not lbl or lbl == 'neutral':
            continue
        if lbl not in seen:
            seen.add(lbl)
            unique.append(e)
            if len(unique) >= 3:
                break

    if len(unique) < 3:
        pad_defaults = [
            {"label": "optimism", "score": 0.5},
            {"label": "joy", "score": 0.3},
            {"label": "sadness", "score": 0.2} 
        ]
        for p in pad_defaults:
            if p["label"] not in seen:
                unique.append(p)
                seen.add(p["label"])
                if len(unique) >= 3:
                    break

    top3 = unique[:3]
    formatted = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)

    return f"Shades of {formatted}.", top3
"""

