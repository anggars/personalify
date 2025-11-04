import os
import requests
import time
import random
from deep_translator import GoogleTranslator

# coba import huggingface_hub.InferenceClient (opsional)
try:
    from huggingface_hub import InferenceClient
    HAS_HF_HUB = True
except Exception:
    InferenceClient = None
    HAS_HF_HUB = False

# Tambahkan ability override URL via env var
API_URL = os.getenv("HUGGING_FACE_API_URL", "https://api-inference.huggingface.co/models/SamLowe/roberta-base-go_emotions")
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")
# Optional: explicit model id and router url via env
HF_MODEL = os.getenv("HUGGING_FACE_MODEL", "SamLowe/roberta-base-go_emotions")
HF_ROUTER = os.getenv("HUGGING_FACE_ROUTER_URL", "https://router.huggingface.co/hf-inference")
headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}

# Add back the full emotion_texts mapping used by the dashboard and formatting
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

# Simple in-memory cache to avoid reprocessing same text repeatedly
_analysis_cache = {}

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

def _normalize_response(result):
	# Normalize various HF/Router shapes into list[dict{label,score}]
	if not result:
		return None
	# direct list of dicts
	if isinstance(result, list) and all(isinstance(i, dict) for i in result):
		return result
	# nested [[{...},...]]
	if isinstance(result, list) and result and isinstance(result[0], list):
		inner = result[0]
		if all(isinstance(i, dict) for i in inner):
			return inner
	# some router variants return {'error':...} or dict with labels/scores
	if isinstance(result, dict):
		# { "labels": [...], "scores": [...] }
		labels = result.get("labels")
		scores = result.get("scores")
		if labels and scores and len(labels) == len(scores):
			return [{"label": l, "score": s} for l, s in zip(labels, scores)]
		# router sometimes wraps in "outputs"
		if "outputs" in result and isinstance(result["outputs"], list):
			return _normalize_response(result["outputs"])
	return None

def _call_hf_api(url, payload, req_headers):
	# wrapper to call HF-like endpoints and return parsed json or raise
	resp = requests.post(url, headers=req_headers, json=payload, timeout=30)
	resp.raise_for_status()
	return resp.json(), resp.status_code

def get_emotion_from_text(text: str):
	"""
	Try huggingface_hub.InferenceClient first (matches HF example).
	If unavailable or fails, fall back to existing HTTP/router logic.
	Returns list of {label,score} or None.
	"""
	if not text:
		return None

	# If no API key, skip HF hub call
	if not HF_API_KEY:
		print("Hugging Face API key missing; skipping HF hub call.")
	else:
		# Try preferred HF InferenceClient (matches HF docs)
		if HAS_HF_HUB and InferenceClient is not None:
			try:
				print("Using huggingface_hub.InferenceClient (provider=hf-inference)...")
				client = InferenceClient(provider="hf-inference", api_key=HF_API_KEY)
				# text_classification returns list of {label, score}
				hf_result = client.text_classification(text, model=HF_MODEL)
				# Normalize: some clients return list or dict — ensure list of dicts
				if isinstance(hf_result, list) and hf_result:
					# ensure dicts have label/score
					if all(isinstance(i, dict) and "label" in i and "score" in i for i in hf_result):
						return hf_result
					# If HF returns wrapped elements, try to normalize
					normalized = _normalize_response(hf_result)
					if normalized:
						return normalized
				# if we got a dict with labels/scores
				norm = _normalize_response(hf_result)
				if norm:
					return norm
			except Exception as e:
				print(f"HF hub client error: {type(e).__name__}: {e}. Falling back to HTTP/router method.")

	# If we get here, try existing HTTP API first (keeps older behavior)
	try:
		payload = {"inputs": text}
		# include small parameter to request more candidates if supported
		params = {"parameters": {"top_k": 20}} if "models" in API_URL else {}
		if params:
			payload.update(params)
		print("🔄 Calling HF API:", API_URL[:200])
		result, status = _call_hf_api(API_URL, payload, req_headers={"Accept": "application/json", **(headers or {})})
		norm = _normalize_response(result)
		if norm:
			return norm
		# if HF returns an informative error payload (e.g., 410), we fallthrough
	except requests.exceptions.HTTPError as he:
		# handle 410 specially (deprecated api-inference host)
		msg = str(he)
		print(f"Hugging Face HTTP error: {msg}")
		# fall through to try router
	except Exception as e:
		print(f"Hugging Face request error: {type(e).__name__}: {e}")

	# If we get here, try router endpoint if configured
	try:
		router_url = HF_ROUTER.rstrip("/")  # e.g. https://router.huggingface.co/hf-inference
		router_payloads = [
			{"model": HF_MODEL, "inputs": text},
			{"model": HF_MODEL, "input": text},
			{"model": HF_MODEL, "data": [text]}
		]
		for rp in router_payloads:
			try:
				print("🔁 Trying HF router:", router_url, "with payload keys:", list(rp.keys()))
				result, _ = _call_hf_api(router_url, rp, req_headers={"Accept": "application/json", **(headers or {})})
				norm = _normalize_response(result)
				if norm:
					return norm
			except requests.exceptions.HTTPError as he:
				# router may respond 404 if path wrong; try next payload
				print(f"Router HTTP error for payload {list(rp.keys())}: {he}")
				continue
			except Exception as e:
				print(f"Router request error for payload {list(rp.keys())}: {type(e).__name__}: {e}")
				continue
	except Exception as e:
		print(f"Router attempt failed: {type(e).__name__}: {e}")

	# All external calls failed
	print("⚠️ Emotion API call failed — will use local fallback.")
	return None

def _fallback_emotions_from_text(text: str, max_labels=5):
	"""
	Improved deterministic fallback:
	- Detect common phrases (e.g. "i dont care") that map to annoyance.
	- Use keyword counts otherwise.
	- Return up to max_labels labels, scores normalized, avoid duplicate labels.
	"""
	if not text:
		return [{"label": "neutral", "score": 1.0}][:max_labels]

	t = text.lower().strip()

	# Phrase-level heuristics (catch short idiomatic inputs)
	phrase_map = [
		(["i dont care", "i don't care", "dont care", "don't care"], [{"label":"annoyance","score":0.6},{"label":"neutral","score":0.2},{"label":"disapproval","score":0.2}]),
		(["i hate you","i hate"], [{"label":"anger","score":0.6},{"label":"disgust","score":0.25},{"label":"sadness","score":0.15}]),
		(["i love you","i love"], [{"label":"love","score":0.7},{"label":"joy","score":0.2},{"label":"gratitude","score":0.1}]),
		(["i'm so excited","im so excited","so excited"], [{"label":"excitement","score":0.7},{"label":"joy","score":0.2},{"label":"optimism","score":0.1}]),
		(["im sad","i am sad","so sad","sadness"], [{"label":"sadness","score":0.8},{"label":"remorse","score":0.1},{"label":"neutral","score":0.1}]),
		(["i miss you","missing you","i miss"], [{"label":"love","score":0.5},{"label":"sadness","score":0.3},{"label":"longing","score":0.2}]),
	]

	for keys, mapped in phrase_map:
		for k in keys:
			if k in t:
				# ensure we return only upto max_labels and normalized
				res = mapped[:max_labels]
				# normalize
				total = sum(item["score"] for item in res) or 1.0
				return [{"label": item["label"], "score": item["score"]/total} for item in res]

	# token-level heuristics (as before, but improved)
	keyword_map = {
		"anger": {"angry", "hate", "fuck", "shit", "bastard", "asshole", "pissed", "hateyou"},
		"sadness": {"sad", "cry", "lonely", "depress", "sedih", "missing"},
		"joy": {"happy", "joy", "glad", "gembira", "bahagia"},
		"love": {"love", "cinta", "rindu", "miss"},
		"fear": {"scared", "afraid", "fear", "takut", "panic"},
		"excitement": {"excite", "excited", "thrill", "hype"},
		"surprise": {"surprise", "shocked", "wow"},
		"nervousness": {"nervous", "anxiety", "anxious"},
		"disgust": {"disgust", "disgusting", "gross"},
		"annoyance": {"dont", "don't", "care", "meh", "whatever", "idc", "dontcare"},
		"neutral": {"okay", "fine", "neutral"}
	}

	words = [w.strip(".,!?:;()\"'") for w in t.split()]
	counts = {}
	for w in words:
		for label, bucket in keyword_map.items():
			if w in bucket:
				counts[label] = counts.get(label, 0) + 1

	# profanity special-case: stronger anger/disgust
	if any(p in t for p in ["fuck", "shit", "bastard", "asshole"]):
		res = [{"label": "anger", "score": 0.75}, {"label": "disgust", "score": 0.25}]
		return res[:max_labels]

	# If we found token matches, build ranked list
	if counts:
		items = sorted([{"label": k, "score": v} for k, v in counts.items()], key=lambda x: -x["score"])
		# convert counts to probabilistic scores
		total = sum(i["score"] for i in items) or 1.0
		items = [{"label": i["label"], "score": i["score"] / total} for i in items]
		# pad with reasonable distinct defaults (avoid duplicate 'neutral' inflation)
		pad_candidates = [{"label":"neutral","score":0.05},{"label":"optimism","score":0.03},{"label":"joy","score":0.02},{"label":"sadness","score":0.02}]
		idx = 0
		while len(items) < max_labels and idx < len(pad_candidates):
			if pad_candidates[idx]["label"] not in [x["label"] for x in items]:
				items.append(pad_candidates[idx])
			idx += 1
		# renormalize
		total = sum(i["score"] for i in items) or 1.0
		for i in items:
			i["score"] = i["score"] / total
		return items[:max_labels]

	# fallback neutral+small variety (avoid repeating neutral twice)
	default = [{"label":"neutral","score":0.6},{"label":"joy","score":0.2},{"label":"sadness","score":0.2}]
	return default[:max_labels]

def analyze_lyrics_emotion(lyrics: str):
	"""
	Analisis emosi dari lirik lagu: return up to 5 labels exactly (label+score).
	If HF/Router unavailable, return deterministic fallback (5 labels).
	"""
	if not lyrics or not lyrics.strip():
		return {"error": "Lyrics input cannot be empty."}

	text = prepare_text_for_analysis(lyrics.strip())
	emotions = None
	if HF_API_KEY:
		emotions = get_emotion_from_text(text)

	if not emotions:
		# fallback to local but ensure 5 labels
		fb = _fallback_emotions_from_text(text, max_labels=5)
		return {"emotions": fb}

	try:
		# ensure floats and order
		sorted_emotions = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
		top5 = sorted_emotions[:5]
		# normalize scores so they sum to 1 (optional but keeps UI stable)
		total = sum(float(e.get("score", 0)) for e in top5) or 1.0
		out = [{"label": e["label"], "score": float(e.get("score", 0)) / total} for e in top5]
		return {"emotions": out}
	except Exception as e:
		print(f"Error parsing HF emotions: {e}")
		# fallback
		fb = _fallback_emotions_from_text(text, max_labels=5)
		return {"emotions": fb}

def generate_emotion_paragraph(track_names, extended=False):
	"""
	Dashboard paragraph generator: uses top 3 labels from HF if available, else fallback (3 labels).
	"""
	if not track_names:
		return "Couldn't analyze music mood."

	tracks_to_analyze = track_names[:20]
	combined = ". ".join(tracks_to_analyze)
	text = prepare_text_for_analysis(combined)

	emotions = None
	if HF_API_KEY:
		emotions = get_emotion_from_text(text)

	if not emotions:
		fb = _fallback_emotions_from_text(text, max_labels=3)
		em_list = fb
	else:
		try:
			em_list = sorted(emotions, key=lambda x: float(x.get("score", 0)), reverse=True)
		except Exception:
			em_list = _fallback_emotions_from_text(text, max_labels=3)

	# Deduplicate labels while preserving order
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

	# If still less than 3, try to pull additional unique labels from remaining em_list
	if len(unique) < 3:
		for e in em_list:
			lbl = e.get("label")
			if not lbl or lbl in seen:
				continue
			seen.add(lbl)
			unique.append(e)
			if len(unique) >= 3:
				break

	# Final pad with sensible defaults (avoid duplicates)
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

	# format using emotion_texts (already defined earlier)
	formatted = ", ".join(emotion_texts.get(e["label"], e["label"]) for e in top3)
	if extended and len(track_names) > 10:
		return f"Diving deeper into your collection, shades of {formatted}."
	return f"Shades of {formatted}."
