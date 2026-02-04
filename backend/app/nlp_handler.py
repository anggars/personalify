
# ==========================================
#  SMART NLP HANDLER (ASYNC & RETRO-COMPATIBLE)
#  Integrated with Retrained Model + Hybrid Fallback
# ==========================================

import os
import re
import asyncio
import time
import requests  # Kept for synchronous fallback if needed, or we use httpx primarily
import httpx     # For Async IO (Smarter!)
from dotenv import load_dotenv

# Optional Imports
try:
    from deep_translator import GoogleTranslator
    HAS_TRANSLATOR = True
except ImportError:
    HAS_TRANSLATOR = False
    print("NLP HANDLER: deep-translator not found. Translation disabled.")

from huggingface_hub import InferenceClient

load_dotenv()

# --- CONFIGURATION ---
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
SPACE_URL = "https://anggars-personalify.hf.space/predict"
MODEL_ROBERTA = "SamLowe/roberta-base-go_emotions"
MODEL_DISTILBERT = "joeddav/distilbert-base-uncased-go-emotions-student"

# Global HF Client (Synchronous for fallback, can be used in threads)
if HF_API_KEY:
    try:
        hf_client = InferenceClient(token=HF_API_KEY, timeout=10.0)
        print("NLP HANDLER: FALLBACK CLIENT READY.")
    except Exception as e:
        print(f"NLP HANDLER: FALLBACK CLIENT INIT FAILED: {e}")
        hf_client = None
else:
    hf_client = None

# --- CACHE ---
# Simple in-memory cache to save API calls
_analysis_cache = {}


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

# --- GOEMOTIONS ID MAP (Safety Net for "LABEL_XX") ---
# Standard GoEmotions taxonomy
GO_EMOTIONS_ID_MAP = {
    "0": "admiration", "1": "amusement", "2": "anger", "3": "annoyance",
    "4": "approval", "5": "caring", "6": "confusion", "7": "curiosity",
    "8": "desire", "9": "disappointment", "10": "disapproval", "11": "disgust",
    "12": "embarrassment", "13": "excitement", "14": "fear", "15": "gratitude",
    "16": "grief", "17": "joy", "18": "love", "19": "nervousness",
    "20": "optimism", "21": "pride", "22": "realization", "23": "relief",
    "24": "remorse", "25": "sadness", "26": "surprise", "27": "neutral"
}

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

# --- HELPERS ---

def normalize_slang(text):
    if not text: return ""
    lines = text.split('\n')
    normalized_lines = []
    
    for line in lines:
        words = line.split()
        normalized_words = []
        for word in words:
            # Simple punctuation removal for slang check
            clean_word = re.sub(r'[^\w\s]', '', word).lower()
            if clean_word in SLANG_MAP:
                 replacement = SLANG_MAP[clean_word]
                 if word and word[0].isupper(): replacement = replacement.capitalize()
                 normalized_words.append(replacement)
            else:
                 normalized_words.append(word)
        normalized_lines.append(" ".join(normalized_words))
        
    return "\n".join(normalized_lines)

def _map_label(label: str) -> str:
    """
    Converts 'LABEL_27' -> 'neutral' using GO_EMOTIONS_ID_MAP.
    """
    if label.startswith("LABEL_"):
        idx = label.replace("LABEL_", "")
        return GO_EMOTIONS_ID_MAP.get(idx, label)
    return label



def prepare_text_for_analysis(text: str) -> str:
    """
    Cleans, normalizes slangs and translates to English.
    Blocking function (runs synchronously).
    """
    if not text or not text.strip():
        return ""

    # 1. Truncate (Safeguard)
    MAX_CHARS = 2500
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    
    # 2. Normalize Slang
    normalized = normalize_slang(text)
    
    # 3. Translate to English (with Retries)
    if HAS_TRANSLATOR:
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                # Use deep-translator
                translator = GoogleTranslator(source='auto', target='en')
                translated = translator.translate(normalized)
                
                # Basic check: if translation failed silently (returned empty)
                if not translated:
                    return normalized
                    
                print(f"NLP HANDLER: TR '{normalized[:20]}...' -> '{translated[:20]}...'")
                return translated
            except Exception as e:
                if attempt < max_retries:
                    time.sleep(1)
                    continue
                else:
                    print(f"NLP HANDLER: Translation Failed ({e}). Using Original.")
                    return normalized
    else:
        return normalized


def _run_fallback_hybrid_analysis(text: str):
    """
    Fallback method: Uses generic HF Inference API with SamLowe + Joeddav.
    This runs synchronously via hf_client.
    """
    if not hf_client:
        print("NLP HANDLER: FALLBACK FAILED - CLIENT NOT READY.")
        return None
        
    print(f"NLP HANDLER: RUNNING FALLBACK HYBRID ANALYSIS...")
    
    try:
        combined_scores = {}
        successful_models = 0
        
        # Truncate strictly for inference API
        valid_text = text[:1200]

        # 1. Try RoBERTa (SamLowe)
        try:
            results_roberta = hf_client.text_classification(valid_text, model=MODEL_ROBERTA, top_k=28)
            # Normalize results structure
            if isinstance(results_roberta, list) and isinstance(results_roberta[0], list):
                 results_roberta = results_roberta[0] # Handle batch return if any
            
            for item in results_roberta:
                label = item['label']
                score = item['score']
                combined_scores[label] = combined_scores.get(label, 0) + score
            successful_models += 1
        except Exception as e:
             print(f"NLP HANDLER: Fallback RoBERTa Failed: {e}")

        # 2. Try DistilBERT (Joeddav)
        try:
            results_distilbert = hf_client.text_classification(valid_text, model=MODEL_DISTILBERT, top_k=28)
             # Normalize results structure
            if isinstance(results_distilbert, list) and isinstance(results_distilbert[0], list):
                 results_distilbert = results_distilbert[0]

            for item in results_distilbert:
                label = item['label']
                score = item['score']
                combined_scores[label] = combined_scores.get(label, 0) + score
            successful_models += 1
        except Exception as e:
             print(f"NLP HANDLER: Fallback DistilBERT Failed: {e}")

        if successful_models == 0:
             return None

        # STRICT FILTER: Remove Neutral
        
        # Pre-process keys in combined_scores to handle LABEL_XX from fallback (rare but possible)
        clean_scores = {}
        for k, v in combined_scores.items():
            clean_lbl = _map_label(k)
            clean_scores[clean_lbl] = clean_scores.get(clean_lbl, 0) + v
            
        combined_scores = clean_scores

        if 'neutral' in combined_scores:
            del combined_scores['neutral']

        # Logic to 'Average' the scores
        total_sum_all_labels = sum(combined_scores.values())
        
        final_results = []
        if total_sum_all_labels > 0:
            for label, raw_sum in combined_scores.items():
                # Re-normalize so sum is 1.0
                final_results.append({"label": label, "score": raw_sum / total_sum_all_labels})
        
        final_results.sort(key=lambda x: x['score'], reverse=True)
        return final_results

    except Exception as e:
        print(f"NLP HANDLER: FALLBACK CRITICAL ERROR: {e}")
        return None


# --- MAIN ANALYSIS FUNCTIONS ---

def get_emotion_from_text(text: str):
    """
    Synchronous wrapper that calls the HF Space.
    Failover to Hybrid Fallback if Space is sleeping or errors.
    """
    if not text or not text.strip():
        return None

    # Check cache
    if text in _analysis_cache:
        return _analysis_cache[text]

    # Try Custom Space (Retrained Model)
    # Using requests with timeout for fail-fast
    headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
    
    try:
        # print(f"NLP HANDLER: Calls {SPACE_URL}...")
        response = requests.post(SPACE_URL, json={"text": text}, headers=headers, timeout=6)
        
        if response.status_code == 200:
            result = response.json()
            emotions = []
            
            # Handle different API return shapes
            if isinstance(result, list): 
                # Sometimes [[{"label":...}]]
                if len(result) > 0 and isinstance(result[0], list):
                    emotions = result[0]
                else:
                    emotions = result
            elif isinstance(result, dict) and "emotions" in result: 
                emotions = result["emotions"]
            else: 
                # Single dict result?
                if "label" in result: emotions = [result]
                else: raise ValueError("Unknown response format")

            # --- STRICT FILTER: REMOVE NEUTRAL & RENORMALIZE ---
            
            # 1. Map Labels first (Fix LABEL_XX)
            for e in emotions:
                e['label'] = _map_label(e.get('label', ''))

            # 2. Remove 'neutral' keys completely
            filtered_emotions = [e for e in emotions if e.get('label', '').lower() != 'neutral']
            
            # 3. Re-normalize scores to sum to 1.0
            total_score = sum(e.get('score', 0) for e in filtered_emotions)
            if total_score > 0:
                for e in filtered_emotions:
                    e['score'] = e.get('score', 0) / total_score
            
            # Sort and Cache
            filtered_emotions.sort(key=lambda x: x.get('score', 0), reverse=True)
            _analysis_cache[text] = filtered_emotions
            return filtered_emotions
        else:
            # raise to trigger fallback
            raise Exception(f"Status {response.status_code}")

    except Exception as e:
        print(f"NLP HANDLER: SPACE FAILED ({e}). FALLBACK TO HYBRID...")
        fallback_result = _run_fallback_hybrid_analysis(text)
        if fallback_result:
            _analysis_cache[text] = fallback_result
            return fallback_result
        return None

# --- PUBLIC FUNCTIONS (Used by Routes) ---

def analyze_lyrics_emotion(lyrics: str):
    """
    Analyzes lyrics and returns the top 5 emotions.
    Input: Lyrics string
    Output: Dict {"emotions": [...]} or {"error": ...}
    """
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}

    # 1. Prepare (Normalize + Translate)
    text = prepare_text_for_analysis(lyrics.strip())
    
    # 2. Analyze (Space -> Fallback)
    emotions = get_emotion_from_text(text)

    if not emotions:
        print("NLP HANDLER: Analysis failed.")
        return {"error": "Emotion analysis unavailable."}

    try:
        # 3. Filter Neutral & Normalize
        # Remove 'neutral' to avoid valid emotions being buried
        filtered_emotions = [e for e in emotions if e.get('label', '').lower() != 'neutral']
        
        # If everything was neutral (empty after filter), keep original top 1 but label it low confidence? 
        # Or just return empty? User said "netral buang" (throw away neutral).
        if not filtered_emotions and emotions:
             # Fallback: if only neutral existed, return it but maybe rename?
             # For now, let's just use the filtered list.
             pass

        # 4. Top 5
        top5 = filtered_emotions[:5]
        
        # Ensure float scores
        out = [{"label": e["label"], "score": float(e.get("score", 0))} for e in top5]
        
        # Debug Print
        # top_str = ", ".join([f"{e['label']}({e['score']:.2f})" for e in out[:3]])
        # print(f"NLP HANDLER: Result -> {top_str}")
        
        return {"emotions": out}

    except Exception as e:
        print(f"NLP HANDLER: Result Parsing Error: {e}")
        return {"error": "Error parsing results."}


def generate_emotion_paragraph(track_names, extended=False):
    """
    Generates a textual summary ("Shades of ...") based on a list of track names.
    Uses a 'Sequential Voting System' for higher accuracy as requested.
    """
    if not track_names:
        return "Couldn't analyze music mood.", []

    num_tracks = len(track_names) if extended else min(10, len(track_names))
    tracks_to_analyze = track_names[:num_tracks]

    voting_tally = {}
    total_valid_songs = 0
    
    for track in tracks_to_analyze:
        try:
            # 1. Prepare
            txt = prepare_text_for_analysis(track)
            if not txt: continue
            
            # 2. Get Emotion
            emotions = get_emotion_from_text(txt)
            
            if emotions:
                # 3. Vote for Top Non-Neutral
                for em in emotions:
                    if em.get("label") != 'neutral':
                        lbl = em.get("label")
                        voting_tally[lbl] = voting_tally.get(lbl, 0) + 1
                        total_valid_songs += 1
                        break # Only vote for the top 1 non-neutral per song
                        
        except Exception:
            continue

    if total_valid_songs == 0:
        return "No clear vibe detected.", []

    # 4. Sort Votes (Primary: Count DESC, Secondary: Label ASC for stability)
    sorted_votes = sorted(voting_tally.items(), key=lambda x: (x[1], x[0]), reverse=True)
    
    # 5. Top 3
    top3_tuples = sorted_votes[:3]
    top3 = [{"label": lbl, "score": count / total_valid_songs} for lbl, count in top3_tuples]

    # 6. Fill if < 3
    if len(top3) < 3:
        existing = set(e["label"] for e in top3)
        defaults = [
            {"label": "optimism", "score": 0.1},
            {"label": "joy", "score": 0.1},
            {"label": "sadness", "score": 0.1} 
        ]
        for p in defaults:
            if p["label"] not in existing:
                top3.append(p)
                existing.add(p["label"])
                if len(top3) >= 3: break
    
    # 7. Format Paragraph
    formatted_str = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)
    
    # 8. Map Labels to Friendly Names for JSON Response (Mobile Consistency)
    # This ensures Mobile sees "Sudden Insight" instead of "Realization"
    clean_top3 = []
    for e in top3:
        lbl = e["label"]
        # Use existing emotion_texts to derive friendly name if possible, or a new map
        # Parsing "sudden <b>insight</b>" -> "Sudden Insight"
        
        friendly = lbl.capitalize()
        if lbl in emotion_texts:
            raw_desc = emotion_texts[lbl] # e.g. "sudden <b>insight</b>"
            # Remove HTML
            clean_desc = raw_desc.replace("<b>", "").replace("</b>", "")
            # Title Case (Sudden Insight)
            friendly = clean_desc.title()
            
        clean_top3.append({"label": friendly, "score": e["score"]})

    # LOG RESULTS (CLEAN)
    clean_summary = formatted_str.replace("<b>", "").replace("</b>", "")
    stats_str = ", ".join([f"{e['label']} ({e['score']:.0%})" for e in clean_top3])
    
    print(f"\nNLP HANDLER: FINAL VIBE -> Shades of {clean_summary}")
    print(f"NLP HANDLER: STATS      -> {stats_str}\n")
    
    return f"Shades of {formatted_str}.", clean_top3
