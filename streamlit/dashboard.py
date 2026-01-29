import streamlit as st
import pandas as pd
import altair as alt
import requests
from bs4 import BeautifulSoup
import re
import time
import os
from pathlib import Path
from deep_translator import GoogleTranslator
from googletrans import Translator as GoogleTransDetector

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

st.set_page_config(
    page_title="Personalify Analysis",
    page_icon="🎵",
    layout="centered"
)

# --- CONFIG & CONSTANTS ---
MODEL_SAMLOWE = "SamLowe/roberta-base-go_emotions"
MODEL_JOEDDAV = "joeddav/distilbert-base-uncased-go-emotions-student"
SPACE_URL = "https://anggars-personalify.hf.space/predict"
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY") # Shared key for Inference API and Space

if not HF_API_KEY:
    try:
        if "HUGGING_FACE_API_KEY" in st.secrets:
             HF_API_KEY = st.secrets["HUGGING_FACE_API_KEY"]
    except:
        pass

def get_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": "CompuServe Classic/1.22"
    }

def clean_lyrics(text):
    text = re.sub(r"\[.*?\]", "", text)
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        s = line.strip()
        if not s: continue
        if re.match(r"^\d+\s+contributors?$", s.lower()): continue
        blocked = [
            "translation", "translated", "lyrics",
            "click", "contribute", "read more",
            "produced by", "written by"
        ]
        if any(b in s.lower() for b in blocked): continue
        cleaned.append(s)
    return "\n".join(cleaned)

def prepare_text_for_api(text):
    lines = text.split('\n')
    unique_lines = []
    seen = set()
    current_length = 0
    SAFE_LIMIT = 2500 # Slightly aggressive limit for API payload
    for line in lines:
        clean_line = line.strip()
        if not clean_line or clean_line in seen:
            continue    
        if current_length + len(clean_line) > SAFE_LIMIT:
            break        
        seen.add(clean_line)
        unique_lines.append(clean_line)
        current_length += len(clean_line) + 2
    return ". ".join(unique_lines)

# --- SLANG DICTIONARY ---
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
    "cape": "lelah", "capek": "lelah"
}

def normalize_slang(text):
    """
    Replaces recognized slang/regional words with formal Indonesian equivalents
    to help the translator.
    """
    if not text: return ""
    
    # Basic tokenization handling punctuation
    # This is a simple replace strategy
    words = text.split()
    normalized_words = []
    
    for word in words:
        # Strip simple punctuation for checking
        clean_word = re.sub(r'[^\w\s]', '', word).lower()
        if clean_word in SLANG_MAP:
             replacement = SLANG_MAP[clean_word]
             # Preserve original case if title
             if word[0].isupper():
                 replacement = replacement.capitalize()
             normalized_words.append(replacement)
        else:
             normalized_words.append(word)
             
    return " ".join(normalized_words)

# --- SCRAPING HELPERS ---
def get_page_html_via_proxy(url):
    translate_url = f"https://translate.google.com/translate?sl=auto&tl=en&u={url}&client=webapp"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    for attempt in range(3):
        try:
            r = requests.get(translate_url, headers=headers, timeout=10)
            if r.status_code == 200:
                return r.text
            time.sleep(1) 
        except Exception:
            time.sleep(1)
    return None

def scrape_lyrics_proxy(song_url):
    html = get_page_html_via_proxy(song_url)
    if not html: return None
    try:
        soup = BeautifulSoup(html, "html.parser")
        containers = soup.select("div[data-lyrics-container]")
        all_lines = []
        for c in containers:
            if "translation" in c.get_text().lower(): continue
            for br in c.find_all("br"): br.replace_with("\n")
            block = c.get_text("\n").strip()
            if block: 
                lines = block.split("\n")
                for line in lines:
                    stripped = line.strip()
                    if stripped: all_lines.append(stripped)
        lyrics_raw = "\n".join(all_lines)
        if not lyrics_raw.strip():
            old = soup.find("div", class_="lyrics")
            if old: lyrics_raw = old.get_text("\n")
        return clean_lyrics(lyrics_raw)
    except Exception:
        return None

def search_genius_manual(query, token):
    try:
        base_url = "https://api.genius.com"
        res = requests.get(
            f"{base_url}/search",
            params={"q": query},
            headers=get_headers(token),
            timeout=10
        )
        return res.json()['response']['hits'] if res.status_code == 200 else None
    except: return None

# --- INFERENCE FUNCTIONS ---

def query_hf_inference_api(payload, model_id):
    """Hits the standard HF Inference API"""
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=8) # Short timeout
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def query_custom_space(text):
    """Hits your custom HF Space"""
    headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
    try:
        response = requests.post(SPACE_URL, headers=headers, json={"text": text}, timeout=12)
        if response.status_code == 200:
            return response.json() # Expecting list of dicts or {"emotions": ...}
        else:
            return {"error": f"Status {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

def parse_inference_result(result):
    """Standardizes HF Inference API output to Dict[Label, Score]"""
    # Result is usually [[{'label': 'joy', 'score': 0.9}, ...]] (list of lists)
    parsed = {}
    if isinstance(result, list) and len(result) > 0 and isinstance(result[0], list):
        for item in result[0]:
            if 'label' in item and 'score' in item:
                parsed[item['label']] = item['score']
    elif isinstance(result, dict) and 'error' in result:
        print(f"Model Error: {result['error']}")
        return None
    return parsed

def parse_space_result(result):
    """Standardizes Custom Space output to Dict[Label, Score]"""
    # Space returns list of dicts directly OR inside 'emotions' key
    parsed = {}
    items = []
    
    if isinstance(result, list):
        items = result
    elif isinstance(result, dict):
        if 'emotions' in result:
            items = result['emotions']
        elif 'error' in result:
            print(f"Space Error: {result['error']}")
            return None

    for item in items:
        if 'label' in item and 'score' in item:
            parsed[item['label']] = float(item['score']) # Ensure float
            
    return parsed if parsed else None


# --- SIDEBAR ---
st.sidebar.header("Configuration")

genius_token = None
if os.getenv("GENIUS_ACCESS_TOKEN"):
    genius_token = os.getenv("GENIUS_ACCESS_TOKEN")
    st.sidebar.success("Genius Token loaded")

if not genius_token:
    try:
        if "GENIUS_ACCESS_TOKEN" in st.secrets:
            genius_token = st.secrets["GENIUS_ACCESS_TOKEN"]
            st.sidebar.success("Genius Token from Secrets")
    except: pass

if not genius_token:
    genius_token = st.sidebar.text_input("Genius Access Token", type="password")

if not HF_API_KEY:
    st.sidebar.error("HF API Key Missing! Models may fail.")
    hf_key_input = st.sidebar.text_input("Hugging Face API Key", type="password")
    if hf_key_input:
        HF_API_KEY = hf_key_input

if not genius_token:
    st.sidebar.warning("Please enter Genius token to continue.")
    st.stop()

st.sidebar.divider()
input_method = st.sidebar.radio("Input Method:", ("Search via Genius API", "Manual Input"))

# --- MAIN UI ---
st.title("Personalify: Hybrid Comparison")
st.caption("Comparing **SamLowe (RoBERTa)**, **Joeddav (DistilBERT)**, and **Custom Space**.")
st.divider()

final_lyrics = ""
song_metadata = {"title": "Unknown Track", "artist": "Unknown Artist"}

if input_method == "Search via Genius API":
    col1, col2 = st.columns([3, 1])
    with col1:
        search_query = st.text_input("Enter Artist & Song Title", placeholder="e.g. COLORCODE - All Is Gone")
    with col2:
        st.write("")
        st.write("")
        search_btn = st.button("Search", type="primary", use_container_width=True)

    if 'search_results' not in st.session_state: st.session_state.search_results = []
    
    if search_btn and genius_token:
        with st.spinner("Searching Genius API..."):
            hits = search_genius_manual(search_query, genius_token)
            if hits:
                st.session_state.search_results = hits
                st.success(f"Found {len(hits)} results!")
            else: st.error("No results found.")

    if st.session_state.search_results:
        options = {f"{h['result']['full_title']}": h['result']['url'] for h in st.session_state.search_results}
        selected = st.selectbox("Select Song:", list(options.keys()))
        if st.button("Fetch & Analyze"):
            target_url = options[selected]
            parts = selected.split(' by ')
            song_metadata = {'title': parts[0], 'artist': parts[1] if len(parts)>1 else "Unknown"}
            
            with st.spinner("Bypassing Genius via Google Proxy..."):
                raw_text = scrape_lyrics_proxy(target_url)
                if raw_text and len(raw_text) > 50:
                    # Apply Slang Normalization here too
                    normalized = normalize_slang(raw_text)
                    final_lyrics = normalized
                    st.toast("Lyrics fetched & Normalized!")
                else: 
                    st.error("Failed to fetch lyrics via Proxy.")




elif input_method == "Manual Input":
    manual_input = st.text_area("Paste lyrics here...", height=200)
    if st.button("Analyze", type="primary"):
        with st.spinner("Normalizing Slang & Regional dialects..."):
             # 1. Normalize Slang -> Formal Indo
             normalized_input = normalize_slang(manual_input)
             # 2. Clean Lyrics (remove [Chorus] etc)
             final_lyrics = clean_lyrics(normalized_input)
             
             if normalized_input != manual_input:
                 st.info("ℹ️ Applied Slang/Regional Normalization.")


if final_lyrics:
    st.divider()
    st.subheader(f"Analysis: {song_metadata['title']}")
    
    with st.expander("View Lyrics Used for Analysis"):
        st.text(final_lyrics)

    # --- TRANSLATION LOGIC (RESTORED) ---
    text_display = final_lyrics
    translated_display = ""
    status_msg = "Processing..."
    
    with st.spinner('Detecting & Translating...'):
        try:
            # 1. Detect Language
            detector = GoogleTransDetector()
            detect_res = detector.detect(final_lyrics[:500])
            lang_code = detect_res.lang
            
            full_lang_names = {
                'id': 'Indonesian', 'su': 'Sundanese', 'jv': 'Javanese', 
                'en': 'English', 'ja': 'Japanese', 'ko': 'Korean', 'tl': 'Tagalog'
            }
            lang_name = full_lang_names.get(lang_code, lang_code.title())

            # 2. Translate if not English
            if lang_code == 'en':
                translated_display = final_lyrics
                status_msg = "English detected (Original)."
            else:
                translator = GoogleTranslator(source='auto', target='en')
                translated_res = translator.translate(final_lyrics[:4500])
                if translated_res and len(translated_res.strip()) > 0:
                    translated_display = translated_res
                    status_msg = f"{lang_name} detected, translated to English."
                else:
                    translated_display = final_lyrics
                    status_msg = "Translation empty, using original."
                
        except Exception as e:
            translated_display = final_lyrics
            status_msg = f"Translation failed ({str(e)}), using original."
            
    st.info(f" Translation Status: {status_msg}")
    
    # Use translated text for API calling
    input_text = prepare_text_for_api(translated_display)
    payload = {"inputs": input_text} # For standard Inference API

    # --- PARALLEL / SEQUENTIAL EXECUTION ---
    results_data = []
    
    # 1. Custom Space (Priority)
    with st.status("Running AI Models...", expanded=True) as status:
        st.write("🚀 Contacting Custom HF Space...")
        space_res_raw = query_custom_space(input_text)
        space_scores = parse_space_result(space_res_raw)
        
        if space_scores:
            st.write("✅ Custom Space: Knowledge Retrieved.")
            for label, score in space_scores.items():
                if label != 'neutral':
                    results_data.append({'label': label.capitalize(), 'score': score, 'model': 'Custom Space'})
        else:
            st.write("⚠️ Custom Space: Failed/Timeout.")

        # 2. SamLowe (RoBERTa)
        st.write("🧠 Querying SamLowe/roberta-base-go_emotions...")
        sam_res_raw = query_hf_inference_api(payload, MODEL_SAMLOWE)
        sam_scores = parse_inference_result(sam_res_raw)
        
        if sam_scores:
            st.write("✅ SamLowe: Inference Complete.")
            for label, score in sam_scores.items():
                if label != 'neutral':
                     results_data.append({'label': label.capitalize(), 'score': score, 'model': 'SamLowe (RoBERTa)'})
        else:
             st.write("⚠️ SamLowe: API Busy/Error.")

        # 3. Joeddav (DistilBERT)
        st.write("🎓 Querying joeddav/distilbert-go_emotions...")
        joe_res_raw = query_hf_inference_api(payload, MODEL_JOEDDAV)
        joe_scores = parse_inference_result(joe_res_raw)
        
        if joe_scores:
             st.write("✅ Joeddav: Inference Complete.")
             for label, score in joe_scores.items():
                 if label != 'neutral':
                     results_data.append({'label': label.capitalize(), 'score': score, 'model': 'Joeddav (DistilBERT)'})
        else:
             st.write("⚠️ Joeddav: API Busy/Error.")
        
        status.update(label="All Models Processed", state="complete", expanded=False)

    # --- VISUALIZATION ---
    if not results_data:
        st.error("All models failed to return valid data. Check API Keys or Internet Connection.")
    else:
        df = pd.DataFrame(results_data)
        
        # Filter top emotions based on Custom Space (if avail) or SamLowe
        # We want to show labels that are relevant to AT LEAST one model
        # Strategy: Get top 5 labels from Custom Space, adding top ones from others if missing
        
        relevant_labels = set()
        
        def get_top_labels(model_name, n=5):
            subset = df[df['model'] == model_name]
            return subset.nlargest(n, 'score')['label'].tolist()

        if space_scores:
            relevant_labels.update(get_top_labels('Custom Space', 5))
        
        relevant_labels.update(get_top_labels('SamLowe (RoBERTa)', 5))
        relevant_labels.update(get_top_labels('Joeddav (DistilBERT)', 5))
        
        df_filtered = df[df['label'].isin(list(relevant_labels))]

        # Colors
        domain = ['Custom Space', 'SamLowe (RoBERTa)', 'Joeddav (DistilBERT)']
        range_ = ['#1f77b4', '#ff7f0e', '#2ca02c'] # Blue, Orange, Green

        chart = alt.Chart(df_filtered).mark_bar().encode(
            x=alt.X('score', axis=alt.Axis(format='%', title='Confidence Score')),
            y=alt.Y('label', sort='-x', title=None),
            color=alt.Color('model', scale=alt.Scale(domain=domain, range=range_), legend=alt.Legend(title="Source Model", orient="bottom")),
            yOffset='model', # Grouped bar chart effect
            tooltip=['label', 'model', alt.Tooltip('score', format='.1%')]
        ).properties(height=max(400, len(relevant_labels)*40))

        st.altair_chart(chart, use_container_width=True)
        
        # --- METRICS ROW ---
        st.markdown("#### Top Emotion by Model")
        c1, c2, c3 = st.columns(3)
        
        def display_top_metric(col, model_name, label_prefix=""):
            try:
                row = df[df['model'] == model_name].nlargest(1, 'score').iloc[0]
                col.metric(label=f"{label_prefix}{model_name}", value=row['label'], delta=f"{row['score']:.1%}")
            except:
                col.write(f"{model_name}: N/A")

        display_top_metric(c1, "Custom Space", "⭐ ")
        display_top_metric(c2, "SamLowe (RoBERTa)")
        display_top_metric(c3, "Joeddav (DistilBERT)")
