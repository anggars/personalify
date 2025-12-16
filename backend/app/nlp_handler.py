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
        hf_client = InferenceClient(token=HF_API_KEY)
        print("NLP HANDLER: HUGGING FACE INFERENCE CLIENT READY.")
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
}

_analysis_cache = {}

def prepare_text_for_analysis(text: str) -> str:
    if not text or not text.strip():
        print("NLP HANDLER: EMPTY TEXT, NOTHING TO TRANSLATE.")
        return ""

    try:
        print(f"NLP HANDLER: ENSURING TEXT IS IN ENGLISH (TRANSLATE IF NEEDED)...")
        try:
            translator = GoogleTranslator(source='auto', target='en')
            translated_text = translator.translate(text)

            if translated_text and len(translated_text.strip()) > 0:
                print(f"NLP HANDLER: TEXT READY FOR ANALYSIS (FULL):\n{translated_text}")
                return translated_text
            else:
                print("NLP HANDLER: TRANSLATION RESULTED IN EMPTY TEXT. USING ORIGINAL TEXT.")
                return text

        except Exception as translate_error:
            print(f"NLP HANDLER: ERROR DURING TRANSLATION: {translate_error}. USING ORIGINAL TEXT.")
            return text

    except Exception as e:
        print(f"NLP HANDLER: GENERAL ERROR IN PREPARE_TEXT_FOR_ANALYSIS: {e}")
        print("NLP HANDLER: USING ORIGINAL TEXT AS FALLBACK.")
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
        text_to_analyze = text[:2000]

        print(" > Calling RoBERTa...")
        results_roberta = hf_client.text_classification(text_to_analyze, model=MODEL_ROBERTA, top_k=28)
        
        print(" > Calling DistilBERT...")
        results_distilbert = hf_client.text_classification(text_to_analyze, model=MODEL_DISTILBERT, top_k=28)

        combined_scores = {}

        for item in results_roberta:
            label = item['label']
            score = item['score']
            combined_scores[label] = combined_scores.get(label, 0) + score

        for item in results_distilbert:
            label = item['label']
            score = item['score']
            combined_scores[label] = combined_scores.get(label, 0) + score

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

        log_str = "\n".join([f"{res['label']}: {res['score']:.2%}" for res in final_results])
        print(f"NLP HANDLER: HYBRID RESULT (ALL) ->\n{log_str}")

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
        return "Couldn't analyze music mood."

    num_tracks = len(track_names) if extended else min(10, len(track_names))
    tracks_to_analyze = track_names[:num_tracks]

    print(f"NLP HANDLER: ANALYZING {num_tracks} TRACKS (EXTENDED={extended})")

    combined_text = "\n".join(tracks_to_analyze)
    text = prepare_text_for_analysis(combined_text)

    if not text or len(text.strip()) == 0:
        print("NLP HANDLER: TEXT FOR ANALYSIS EMPTY AFTER TRANSLATION.")
        return "Vibe analysis failed (empty text after translation)."

    emotions = get_emotion_from_text(text)

    if not emotions:
        return "Vibe analysis is currently unavailable."

    try:
        em_list = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
    except Exception:
        return "Vibe analysis failed (parsing error)."

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

    return f"Shades of {formatted}."