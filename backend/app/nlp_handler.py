
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
SPACE_URL = "https://anggars-mbti-emotion.hf.space/api/predict"
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

# --- MBTI CONNECTORS ("Soul" Words) ---
MBTI_CONNECTORS = {
    "INTJ": "calculated by", "INTP": "deconstructed by",
    "ENTJ": "driven by", "ENTP": "chaos of",
    "INFJ": "unseen by", "INFP": "lingering in",
    "ENFJ": "embraced by", "ENFP": "wandering with",
    "ISTJ": "grounded in", "ISFJ": "guarded by",
    "ESTJ": "defined by", "ESFJ": "shared by",
    "ISTP": "crafted by", "ISFP": "painted by",
    "ESTP": "ignited by", "ESFP": "vibrating in",
    "default": "reflected in",
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


def _log_emotions(text: str, emotions: list):
    """
    Helper to print verbose emotion analysis logs.
    Consolidated into a single print to avoid interleaved output.
    """
    if not emotions:
        return

    log_lines = [f"\n[NLP] Full Emotion Analysis for: '{text[:50]}...'"]
    for idx, emotion in enumerate(emotions, 1):
        label = emotion.get('label', 'unknown')
        score = emotion.get('score', 0.0)
        log_lines.append(f" {idx:02d}. {label:<16} : {score:.5f}")
    log_lines.append("-" * 40)
    
    print("\n".join(log_lines))



# --- MAIN ANALYSIS FUNCTIONS ---

def get_emotion_from_text(text: str):
    """
    Calls the new MBTI-Emotion Gradio Space via gradio_client.
    Returns a tuple: (emotions_list, mbti_list)
    Failover to Hybrid Fallback (emotion-only) if Space is sleeping or errors.
    """
    if not text or not text.strip():
        return None, None

    # Check cache
    if text in _analysis_cache:
        return _analysis_cache[text]

    try:
        import json as _json
        
        # --- Step 1: Submit job ---
        # Gradio 6.x uses /gradio_api prefix (from space config)
        base = "https://anggars-mbti-emotion.hf.space/gradio_api"
        submit_url = f"{base}/call/predict"
        headers = {"Content-Type": "application/json"}
        if HF_API_KEY:
            headers["Authorization"] = f"Bearer {HF_API_KEY}"
        
        submit_resp = requests.post(
            submit_url,
            json={"data": [text]},
            headers=headers,
            timeout=30
        )
        
        if submit_resp.status_code != 200:
            raise Exception(f"Submit failed: {submit_resp.status_code} {submit_resp.text[:200]}")
        
        event_id = submit_resp.json().get("event_id")
        if not event_id:
            raise Exception(f"No event_id in response: {submit_resp.text[:200]}")
        
        # --- Step 2: Poll result (SSE stream) ---
        result_url = f"{base}/call/predict/{event_id}"
        result_resp = requests.get(result_url, headers=headers, timeout=120, stream=True)
        
        # Parse SSE: Gradio 6.x LabelData format
        # Response output is: [LabelData_emo, LabelData_mbti]
        # LabelData = {"label": "top_label", "confidences": [{"label": "...", "confidence": 0.9}, ...]}
        emo_data = None
        mbti_data = None
        
        for line in result_resp.iter_lines(decode_unicode=True):
            if line and line.startswith("data:"):
                raw_data = line[len("data:"):].strip()
                try:
                    parsed = _json.loads(raw_data)
                    if isinstance(parsed, list) and len(parsed) >= 2:
                        emo_data = parsed[0]
                        mbti_data = parsed[1]
                        break
                except Exception:
                    continue
        
        if not emo_data or not mbti_data:
            raise Exception("Could not parse Gradio SSE response")
        
        # --- PARSE EMOTIONS (LabelData format) ---
        emotions = []
        confidences = emo_data.get("confidences", [])
        for item in confidences:
            clean_label = str(item.get("label", "")).lower()
            score = float(item.get("confidence", 0))
            if clean_label == "neutral":
                continue
            emotions.append({"label": clean_label, "score": score})
        
        # Re-normalize after removing neutral
        total_score = sum(e["score"] for e in emotions)
        if total_score > 0:
            for e in emotions:
                e["score"] = e["score"] / total_score
        
        emotions.sort(key=lambda x: x["score"], reverse=True)
        
        # --- PARSE MBTI (LabelData format) ---
        mbti = []
        mbti_confidences = mbti_data.get("confidences", [])
        for item in mbti_confidences:
            mbti.append({"label": str(item.get("label", "")).upper(), "score": float(item.get("confidence", 0))})
        mbti.sort(key=lambda x: x["score"], reverse=True)
        
        # Cache as tuple
        _analysis_cache[text] = (emotions, mbti)
        print(f"NLP HANDLER: SPACE OK -> Top Emo: {emotions[0]['label'] if emotions else '?'}, Top MBTI: {mbti[0]['label'] if mbti else '?'}")
        return emotions, mbti

    except Exception as e:
        print(f"NLP HANDLER: SPACE FAILED ({e}). FALLBACK TO HYBRID...")
        fallback_result = _run_fallback_hybrid_analysis(text)
        if fallback_result:
            _analysis_cache[text] = (fallback_result, None)
            return fallback_result, None
        return None, None

# --- PUBLIC FUNCTIONS (Used by Routes) ---

def analyze_lyrics_emotion(lyrics: str):
    """
    Analyzes lyrics and returns the top 5 emotions + top 3 MBTI.
    Input: Lyrics string
    Output: Dict {"emotions": [...], "mbti": [...]} or {"error": ...}
    """
    if not lyrics or not lyrics.strip():
        return {"error": "Lyrics input cannot be empty."}

    # Send raw text to API — no translation needed
    # XLM-RoBERTa model handles multilingual input natively
    text = lyrics.strip()
    if len(text) > 2500:
        text = text[:2500]
    
    # 2. Analyze (Space -> Fallback)
    emotions, mbti = get_emotion_from_text(text)

    if not emotions:
        print("NLP HANDLER: Analysis failed.")
        return {"error": "Emotion analysis unavailable."}

    try:
        # 3. Filter Neutral (already done in get_emotion_from_text, but double-check)
        filtered_emotions = [e for e in emotions if e.get('label', '').lower() != 'neutral']

        # 4. Top 5
        top5 = filtered_emotions[:5]
        
        # Ensure float scores
        out = [{"label": e["label"], "score": float(e.get("score", 0))} for e in top5]
        
        # MBTI output (top 3)
        mbti_out = []
        if mbti:
            mbti_out = [{"label": m["label"], "score": float(m.get("score", 0))} for m in mbti[:3]]
        
        result = {"emotions": out}
        if mbti_out:
            result["mbti"] = mbti_out
        
        return result

    except Exception as e:
        print(f"NLP HANDLER: Result Parsing Error: {e}")
        return {"error": "Error parsing results."}


def generate_emotion_paragraph(track_names, extended=False):
    """
    Generates a textual summary ("Shades of ...") based on a list of track names.
    Concatenates all track titles into one text and sends as a single API call.
    Now includes MBTI: "Shades of [emo1] and [emo2] [connector] [MBTI]."
    """
    if not track_names:
        return "Couldn't analyze music mood.", []

    num_tracks = len(track_names) if extended else min(10, len(track_names))
    tracks_to_analyze = track_names[:num_tracks]

    # Concatenate all track names into a single text
    combined_text = ", ".join(tracks_to_analyze)
    print(f"\n[NLP] Combined Text for {num_tracks} tracks: '{combined_text[:80]}...'")

    # Prepare (Normalize + Translate)
    txt = prepare_text_for_analysis(combined_text)
    if not txt:
        return "No clear vibe detected.", []

    # Single API call for all tracks
    emotions, mbti = get_emotion_from_text(txt)

    if not emotions:
        return "No clear vibe detected.", []

    has_mbti = mbti and len(mbti) > 0

    if has_mbti:
        # --- MBTI MODE: Top 2 Emotions + MBTI ---
        top_emo = emotions[:2]
        if len(top_emo) < 2:
            existing = set(e["label"] for e in top_emo)
            for p in [{"label": "optimism", "score": 0.1}, {"label": "joy", "score": 0.1}]:
                if p["label"] not in existing:
                    top_emo.append(p)
                    existing.add(p["label"])
                    if len(top_emo) >= 2: break

        top_mbti = mbti[0]["label"]
        connector = MBTI_CONNECTORS.get(top_mbti, MBTI_CONNECTORS["default"])

        text1 = emotion_texts.get(top_emo[0]["label"], top_emo[0]["label"])
        text2 = emotion_texts.get(top_emo[1]["label"], top_emo[1]["label"])
        formatted_str = f"{text1} and {text2} {connector} <b>{top_mbti}</b>"
        source_emotions = top_emo
    else:
        # --- FALLBACK MODE: Top 3 Emotions (no MBTI) ---
        top3 = emotions[:3]
        if len(top3) < 3:
            existing = set(e["label"] for e in top3)
            for p in [{"label": "optimism", "score": 0.1}, {"label": "joy", "score": 0.1}, {"label": "sadness", "score": 0.1}]:
                if p["label"] not in existing:
                    top3.append(p)
                    existing.add(p["label"])
                    if len(top3) >= 3: break

        formatted_str = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)
        source_emotions = top3

    # --- Build clean labels for JSON (Mobile Consistency) ---
    clean_top = []
    for e in source_emotions:
        lbl = e["label"]
        friendly = lbl.capitalize()
        if lbl in emotion_texts:
            raw_desc = emotion_texts[lbl]
            clean_desc = raw_desc.replace("<b>", "").replace("</b>", "")
            friendly = clean_desc.title()
        clean_top.append({"label": friendly, "score": e["score"]})

    # LOG RESULTS
    clean_summary = formatted_str.replace("<b>", "").replace("</b>", "")
    stats_str = ", ".join([f"{e['label']} ({e['score']:.0%})" for e in clean_top])
    mode_str = f"MBTI: {mbti[0]['label']}" if has_mbti else "NO MBTI (fallback)"
    
    print(f"\nNLP HANDLER: FINAL VIBE -> Shades of {clean_summary}")
    print(f"NLP HANDLER: STATS      -> {stats_str} | {mode_str}\n")
    
    return f"Shades of {formatted_str}.", clean_top
