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
    print("WARNING: HUGGING_FACE_API_KEY NOT FOUND IN .ENV FILE.")
    print("EMOTION ANALYSIS WILL NOT WORK WITHOUT API KEY.")
    print("="*50)
    hf_client = None
else:
    try:
        hf_client = InferenceClient(model=HF_MODEL, token=HF_API_KEY)
        print("NLP HANDLER: HUGGING FACE INFERENCE CLIENT READY.")
    except Exception as e:
        print(f"NLP HANDLER: FAILED TO INITIALIZE INFERENCE CLIENT. ERROR: {e}")
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
        print("NLP HANDLER: HF CLIENT NOT READY. ANALYSIS CANCELLED.")
        return None
    if not text or not text.strip():
        print("NLP HANDLER: INPUT TEXT EMPTY. ANALYSIS CANCELLED.")
        return None

    if text in _analysis_cache:
        print("NLP HANDLER: FETCHING RESULT FROM CACHE.")
        return _analysis_cache[text]

    try:
        print(f"NLP HANDLER: CALLING HF API FOR ANALYSIS...")

        text_to_analyze = text[:510]

        results = hf_client.text_classification(text_to_analyze, top_k=28)

        if results and isinstance(results, list):
            details_lines = ["NLP HANDLER: SUCCESSFUL. FULL EMOTION DETAILS:"]
            for res in results:

                details_lines.append(f"  > {res['label']:<15} : {res['score']:.4f}")
            print("\n".join(details_lines))
            _analysis_cache[text] = results
            return results
        else:
            print(f"NLP HANDLER: UNEXPECTED RESULT FORMAT: {results}")
            return None

    except Exception as e:
        print(f"NLP HANDLER: ERROR API CALL: {e}")
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
        sorted_emotions = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
        top5 = sorted_emotions[:5]
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
        if not lbl:
            continue
        if lbl not in seen:
            seen.add(lbl)
            unique.append(e)
            if len(unique) >= 3:
                break

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

    if extended and num_tracks > 10:
        return f"Shades of {formatted}."

    return f"Shades of {formatted}."