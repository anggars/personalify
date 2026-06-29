import json
import threading
import os
import re
import time
import requests
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

# --- CONFIGURATION ---
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
SPACE_URL = "https://anggars-mbti-emotion.hf.space/gradio_api"
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

# --- DATA MAPS ---
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

_analysis_cache = {}
_cache_lock = threading.Lock()

def prepare_text_for_analysis(text: str) -> str:
    """
    Cukup bersihin teks dan potong biar gak kepanjangan.
    Gak perlu normalize slang atau translasi di sini biar gak redundan.
    """
    if not text or not text.strip():
        return ""

    # 1. Truncate (Safeguard 2500 karakter biar aman di API)
    MAX_CHARS = 2500
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    
    # 2. Return mentah, biarin app.py di Space yang urus mapping & translation
    return text.strip()

def _map_label(label: str) -> str:
    """
    Converts 'LABEL_27' -> 'neutral' using GO_EMOTIONS_ID_MAP.
    """
    if label.startswith("LABEL_"):
        idx = label.replace("LABEL_", "")
        return GO_EMOTIONS_ID_MAP.get(idx, label)
    return label


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
    Panggil Space baru. Logika SSE parsing udah bener buat Gradio 6.x.
    """
    if not text or not text.strip():
        return None, None

    if text in _analysis_cache:
        return _analysis_cache[text]

    try:
        import json as _json
        
        # Submit job
        submit_url = f"{SPACE_URL}/call/predict"
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
            raise Exception(f"Submit failed: {submit_resp.status_code}")
        
        event_id = submit_resp.json().get("event_id")
        result_url = f"{SPACE_URL}/call/predict/{event_id}"
        result_resp = requests.get(result_url, headers=headers, timeout=120, stream=True)
        
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
            raise Exception("Gagal parse response Space")
        
        # Parse Emotions
        emotions = []
        for item in emo_data.get("confidences", []):
            label = str(item.get("label", "")).lower()
            if label == "neutral": continue
            emotions.append({"label": label, "score": float(item.get("confidence", 0))})
        
        # Re-normalize emotions after removing neutral
        total_emo_score = sum(e["score"] for e in emotions)
        if total_emo_score > 0:
            for e in emotions:
                e["score"] /= total_emo_score
        emotions.sort(key=lambda x: x["score"], reverse=True)
        
        # Parse MBTI
        mbti = []
        for item in mbti_data.get("confidences", []):
            mbti.append({"label": str(item.get("label", "")).upper(), "score": float(item.get("confidence", 0))})
        mbti.sort(key=lambda x: x["score"], reverse=True)
        
        _analysis_cache[text] = (emotions, mbti)
        print(f"NLP HANDLER: SPACE OK -> Top Emo: {emotions[0]['label'] if emotions else '?'}, Top MBTI: {mbti[0]['label'] if mbti else '?'}")
        return emotions, mbti

    except Exception as e:
        print(f"NLP HANDLER: SPACE ERROR ({e}). Pake Fallback.")
        fallback = _run_fallback_hybrid_analysis(text)
        if fallback:
            return fallback, None
        return None, None

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
        
        # --- CONSOLIDATED LOGGING (Single Song) ---
        report_lines = []
        report_lines.append("\n" + "="*60)
        report_lines.append("  PERSONALIFY SINGLE-TRACK ANALYSIS REPORT")
        report_lines.append("="*60)
        report_lines.append(f"  TEXT: \"{text[:100]}{'...' if len(text) > 100 else ''}\"")
        report_lines.append("-" * 60)
        
        report_lines.append("  EMOTION SCORES (Top 5):")
        for i, e in enumerate(out, 1):
            report_lines.append(f"    {i:2d}. {e['label'].title():<15} : {e['score']:6.1%}")
        report_lines.append("-" * 60)
        
        if mbti_out:
            report_lines.append("  MBTI BREAKDOWN (Top 3):")
            for i, m in enumerate(mbti_out, 1):
                report_lines.append(f"    {i:2d}. {m['label']:<15} : {m['score']:6.1%}")
            report_lines.append("-" * 60)
        
        report_lines.append("="*60 + "\n")
        print("\n".join(report_lines))
        
        return result

    except Exception as e:
        print(f"NLP HANDLER: Result Parsing Error: {e}")
        return {"error": "Error parsing results."}


def generate_sentiment_analysis(tracks, progress_callback=None, extended=False):
    """
    Generates a textual summary based on lyrics from top tracks.
    - Genius is the PRIMARY lyrics source (user explicit preference)
    - LRCLib is the fallback
    - Instrumentals and tracks with no lyrics are SKIPPED (not analyzed as title)
    - Already-cached tracks (Redis) are returned instantly without re-fetching
    - In extended mode (Top 20), tracks 0-9 are read from cache only; 
      tracks 10-19 are newly analyzed. This allows resumption from 11/20.
    - All track emotions are collected per-track, then averaged at the end.
    """
    if not tracks:
        return "Couldn't analyze music mood.", []

    num_tracks = len(tracks) if extended else min(10, len(tracks))
    tracks_to_analyze = tracks[:num_tracks]

    from app.genius_lyrics import search_track_lyrics, fetch_lrclib_lyrics
    from app.cache_handler import get_analysis_cache, set_analysis_cache

    log_output = "\n" + "="*50 + "\n"
    log_output += " NLP SENTIMENT ANALYSIS REPORT\n"
    log_output += "="*50 + "\n\n"

    all_emotions_accum = {}
    all_mbti_accum = {}
    successful_analyses = 0

    for idx, track in enumerate(tracks_to_analyze):
        if not isinstance(track, dict):
            continue

        t_name = track.get("name", "")
        a_name = ""
        raw_a = track.get("artist") or track.get("artists")
        if isinstance(raw_a, list) and raw_a:
            first_a = raw_a[0]
            a_name = first_a.get("name", "") if isinstance(first_a, dict) else str(first_a)
        elif isinstance(raw_a, dict):
            a_name = raw_a.get("name", "")
        elif raw_a:
            a_name = str(raw_a)

        d_name = f"{t_name} by {a_name}" if a_name else t_name

        # --- PROGRESS UPDATE (Ordered) ---
        # Call it here at the START of processing each track
        if progress_callback:
            try:
                progress_callback({
                    "current": idx + 1,
                    "total": num_tracks,
                    "trackName": t_name
                })
            except:
                pass

        # --- CACHE CHECK (always first, regardless of position) ---
        with _cache_lock:
            cached = _analysis_cache.get(d_name)

        if not cached:
            cached = get_analysis_cache(d_name)
            if cached:
                with _cache_lock:
                    _analysis_cache[d_name] = (cached[0], cached[1])
                print(f"NLP: Cache Hit for '{d_name}'.")

        if cached:
            emo, mbti_r = cached[0], cached[1]
            
            log_output += f"--- CACHE HIT FOR: {d_name} ---\n"
            log_output += f"Cached Track Scores -> Emotions: {emo} | MBTI: {mbti_r}\n"
            log_output += "----------------------------------\n\n"
            
            if emo:
                for e in emo:
                    all_emotions_accum[e["label"]] = all_emotions_accum.get(e["label"], 0) + e["score"]
                if mbti_r:
                    for m in mbti_r:
                        all_mbti_accum[m["label"]] = all_mbti_accum.get(m["label"], 0) + m["score"]
                successful_analyses += 1
            continue

        # Track not in cache — analyze fresh regardless of position (idx 0-9 also get retried)
        # This ensures tracks that previously had no Genius lyrics get another attempt
        # --- LYRICS FETCH (Genius primary, LRCLib fallback, skip if none) ---

        lyrics = None

        # Skip known instrumentals
        is_instrumental = (
            "instrumental" in t_name.lower() or
            "interlude" in t_name.lower() or
            not t_name or not a_name
        )

        if not is_instrumental:
            # Try combined search (LRCLib -> Genius -> Google)
            try:
                lyrics = search_track_lyrics(t_name, a_name)
            except:
                pass

        # CRITICAL: If no lyrics found, SKIP this track entirely (don't fall back to title)
        if not lyrics:
            log_output += f"--- SKIPPED: {d_name} (No lyrics found) ---\n\n"
            continue


        txt = prepare_text_for_analysis(lyrics)
        if not txt:
            log_output += f"--- SKIPPED: {d_name} (Lyrics preparation failed) ---\n\n"
            continue
            
        log_output += f"--- STARTING ANALYSIS FOR: {d_name} ---\n"
        log_output += f"LYRICS USED IN CALCULATION:\n{txt}\n----------------------------------\n"

        try:
            emo, mbti_r = get_emotion_from_text(txt)
            if emo:
                with _cache_lock:
                    _analysis_cache[d_name] = (emo, mbti_r)
                set_analysis_cache(d_name, [emo, mbti_r])
                
                log_output += f"ANALYSIS SUCCESS FOR '{d_name}'.\n"
                log_output += f"Fresh Track Scores -> Emotions: {emo} | MBTI: {mbti_r}\n\n"

                for e in emo:
                    all_emotions_accum[e["label"]] = all_emotions_accum.get(e["label"], 0) + e["score"]
                if mbti_r:
                    for m in mbti_r:
                        all_mbti_accum[m["label"]] = all_mbti_accum.get(m["label"], 0) + m["score"]
                successful_analyses += 1
                # log_output += f"Analyzed '{d_name}' → top emotion: {emo[0]['label'] if emo else 'none'}\n"
        except Exception as e:
            log_output += f"--- ERROR ANALYZING '{d_name}': {e} ---\n\n"
            continue

    if successful_analyses == 0:
        log_output += "NO CLEAR VIBE DETECTED. 0 SUCCESSFUL ANALYSES.\n"
        log_output += "="*50 + "\n"
        print(log_output)
        return "No clear vibe detected.", []

    log_output += f"=== AVERAGING COMPLETION ===\n"
    log_output += f"Total successfully analyzed tracks: {successful_analyses}\n"
    log_output += f"Accumulated Emotion Scores: {all_emotions_accum}\n"
    log_output += f"Accumulated MBTI Scores: {all_mbti_accum}\n"

    # --- AVERAGING ---
    avg_emotions = []
    for label, total_score in all_emotions_accum.items():
        avg = total_score / successful_analyses
        avg_emotions.append({"label": label, "score": avg})
    avg_emotions.sort(key=lambda x: x["score"], reverse=True)

    avg_mbti = []
    if all_mbti_accum:
        for label, total_score in all_mbti_accum.items():
            avg = total_score / successful_analyses
            avg_mbti.append({"label": label, "score": avg})
        avg_mbti.sort(key=lambda x: x["score"], reverse=True)

    log_output += f"Final Averaged Emotions -> {avg_emotions}\n"
    log_output += f"Final Averaged MBTI -> {avg_mbti}\n"
    log_output += "="*50 + "\n"

    print(log_output)

    all_emotions_accum = avg_emotions
    all_mbti_accum = avg_mbti

    emotions = avg_emotions
    mbti = avg_mbti
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

    # --- CONSOLIDATED LOGGING (Vercel-Friendly) ---
    report_lines = []
    report_lines.append("\n" + "="*60)
    report_lines.append(f"  PERSONALIFY ANALYSIS REPORT ({'EXTENDED' if extended else 'STANDARD'})")
    report_lines.append("="*60)
    
    # 1. Tracks Analyzed
    report_lines.append(f"  TRACKS ({num_tracks}):")
    for i, t in enumerate(tracks_to_analyze, 1):
        report_lines.append(f"    {i:2d}. {t}")
    report_lines.append("-" * 60)
    
    # 2. All Emotions
    report_lines.append("  EMOTION SCORES:")
    if emotions:
        for i, e in enumerate(emotions, 1):
            lbl = e['label'].title()
            score = e['score']
            report_lines.append(f"    {i:2d}. {lbl:<15} : {score:6.1%}")
    else:
        report_lines.append("    (No emotions detected)")
    report_lines.append("-" * 60)
    
    # 3. MBTI Results
    report_lines.append("  MBTI BREAKDOWN:")
    if has_mbti:
        for i, m in enumerate(mbti, 1):
            lbl = m['label']
            score = m['score']
            report_lines.append(f"    {i:2d}. {lbl:<15} : {score:6.1%}")
    else:
        report_lines.append("    (No MBTI data available)")
    report_lines.append("-" * 60)
    
    # 4. Final Paragraph
    report_lines.append("  FINAL VIBE Paragraph:")
    report_lines.append(f"    \"{formatted_str}\"")
    report_lines.append("="*60 + "\n")
    
    # Single print call to prevent interleaving
    print("\n".join(report_lines))
    
    return f"Shades of {formatted_str}.", clean_top

def analyze_multimodal_track(audio_path: str | None = None, lyrics: str | None = None):
    """
    Analyzes track using neural-mathrock Gradio Space.
    Returns: {"mbti": {...}, "emotions": {...}}
    """
    try:
        from gradio_client import Client, handle_file
        
        # Connect to HF Space with extended timeout (120s)
        client = Client("anggars/neural-mathrock", httpx_kwargs={"timeout": 120.0})
        
        # Call the endpoint
        result = client.predict(
            audio_path=handle_file(audio_path) if audio_path else None,
            lyrics_input=lyrics or "",
            api_name="/analyze_track"
        )
        
        # Result is a tuple: (mbti_dict, emotion_dict)
        # Format from Gradio is usually dict with 'confidences' list:
        # {'label': '...', 'confidences': [{'label': 'ENTP', 'confidence': 0.8}, ...]}
        mbti_raw, emotions_raw = result
        
        mbti_dict = {}
        if isinstance(mbti_raw, dict) and "confidences" in mbti_raw:
            for item in mbti_raw["confidences"]:
                mbti_dict[item["label"]] = item["confidence"]
        elif isinstance(mbti_raw, dict): # Fallback
            mbti_dict = mbti_raw
            
        emotions_dict = {}
        if isinstance(emotions_raw, dict) and "confidences" in emotions_raw:
            for item in emotions_raw["confidences"]:
                emotions_dict[item["label"]] = item["confidence"]
        elif isinstance(emotions_raw, dict):
            emotions_dict = emotions_raw

        # Check for error returned in the dict
        for key in emotions_dict.keys():
            if "Audio Error:" in key:
                return {"error": key}
                
        return {"mbti": mbti_dict, "emotions": emotions_dict}
    except Exception as e:
        print(f"MULTIMODAL ANALYSIS ERROR: {e}")
        return {"error": str(e)}