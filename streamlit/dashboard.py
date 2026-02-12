import streamlit as st
import pandas as pd
import altair as alt
from transformers import pipeline
from deep_translator import GoogleTranslator
from googletrans import Translator as GoogleTransDetector
import requests
from bs4 import BeautifulSoup
import re
import time
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

st.set_page_config(
    page_title="Personalify Analyzer",
    page_icon=None,
    layout="centered"
)

# --- CONFIG & CONSTANTS ---
# Removed MODEL_SAMLOWE, MODEL_JOEDDAV, SPACE_URL, HF_API_KEY as they are for Inference API

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

def prepare_text_for_ai(text):
    lines = text.split('\n')
    unique_lines = []
    seen = set()
    current_length = 0
    SAFE_LIMIT = 1200
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
    to help the translator, while PRESERVING LINE BREAKS.
    """
    if not text: return ""
    
    lines = text.split('\n')
    normalized_lines = []
    
    for line in lines:
        words = line.split()
        normalized_words = []
        
        for word in words:
            # Strip simple punctuation for checking
            clean_word = re.sub(r'[^\w\s]', '', word).lower()
            if clean_word in SLANG_MAP:
                 replacement = SLANG_MAP[clean_word]
                 # Preserve original case if title
                 if word and word[0].isupper():
                     replacement = replacement.capitalize()
                 normalized_words.append(replacement)
            else:
                 normalized_words.append(word)
        
        normalized_lines.append(" ".join(normalized_words))
              
    return "\n".join(normalized_lines)

# --- SCRAPING HELPERS ---
def get_page_html_via_proxy(url):
    translate_url = f"https://translate.google.com/translate?sl=auto&tl=en&u={url}&client=webapp"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    for attempt in range(3):
        try:
            r = requests.get(translate_url, headers=headers, timeout=20)
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

# --- MODEL LOADING ---
# --- New XLM-RoBERTa Config ---
SPACE_URL_BASE = "https://anggars-mbti-emotion.hf.space/gradio_api"
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY")

if not HF_API_KEY:
    try:
        if "HUGGING_FACE_API_KEY" in st.secrets:
            HF_API_KEY = st.secrets["HUGGING_FACE_API_KEY"]
    except:
        pass

def query_xlm_roberta(text):
    """Query the new XLM-RoBERTa model via Gradio SSE API"""
    if not text: return None
    
    headers = {"Content-Type": "application/json"}
    if HF_API_KEY:
        headers["Authorization"] = f"Bearer {HF_API_KEY}"
        
    try:
        # 1. Submit Job
        submit_url = f"{SPACE_URL_BASE}/call/predict"
        res = requests.post(submit_url, json={"data": [text]}, headers=headers, timeout=10)
        if res.status_code != 200: return None
        
        event_id = res.json().get("event_id")
        if not event_id: return None
        
        # 2. Poll for Result (SSE)
        result_url = f"{SPACE_URL_BASE}/call/predict/{event_id}"
        # We'll use a simple timeout for polling in Streamlit
        for _ in range(20): # Max 20 attempts
            poll_res = requests.get(result_url, headers=headers, timeout=10)
            if poll_res.status_code == 200:
                # Gradio returns multiple lines, find the one starting with 'data:'
                for line in poll_res.text.split('\n'):
                    if line.startswith("data:"):
                        import json
                        raw_data = line[len("data:"):].strip()
                        try:
                            parsed = json.loads(raw_data)
                            if isinstance(parsed, list) and len(parsed) >= 2:
                                # emotions is parsed[0], mbti is parsed[1]
                                # Format for dashboard-compatible list:
                                emotions = []
                                for item in parsed[0].get("confidences", []):
                                    emotions.append({
                                        "label": item.get("label", "").lower(),
                                        "score": float(item.get("confidence", 0))
                                    })
                                return emotions
                        except:
                            continue
            time.sleep(0.5)
        return None
    except Exception as e:
        print(f"XLM-RoBERTa Error: {e}")
        return None

@st.cache_resource
def load_models():
    from transformers import pipeline
    roberta = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions", top_k=None)
    distilbert = pipeline("text-classification", model="joeddav/distilbert-base-uncased-go-emotions-student", top_k=None)
    return roberta, distilbert

# --- SIDEBAR ---
st.sidebar.header("Configuration")

genius_token = None

if os.getenv("GENIUS_ACCESS_TOKEN"):
    genius_token = os.getenv("GENIUS_ACCESS_TOKEN")
    st.sidebar.success("Token loaded from .env")

if not genius_token:
    try:
        if "GENIUS_ACCESS_TOKEN" in st.secrets:
            genius_token = st.secrets["GENIUS_ACCESS_TOKEN"]
            st.sidebar.success("Token loaded from Secrets")
    except Exception:
        pass

if not genius_token:
    genius_token = st.sidebar.text_input("Genius Access Token", type="password")

if not genius_token:
    st.sidebar.warning("Please enter a token to continue.")
    st.stop()

st.sidebar.divider()
input_method = st.sidebar.radio("Input Method:", ("Search via Genius API", "Manual Input"))

with st.spinner('Loading AI Engines...'):
    roberta_model, distilbert_model = load_models()

# --- MAIN UI ---
st.title("Personalify: Sentiment Analysis")
st.caption("Comparing **RoBERTa**, **DistilBERT**, **XLM-RoBERTa**, and **Hybrid Consensus**.")
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
                 st.info("Applied Slang/Regional Normalization.")

if final_lyrics:
    st.divider()
    st.subheader(f"Analysis: {song_metadata['title']}")
    
    text_display = final_lyrics
    translated_display = ""
    status_msg = "Processing..."
    
    with st.spinner('Detecting & Translating...'):
        try:
            detector = GoogleTransDetector()
            detect_res = detector.detect(final_lyrics[:500])
            lang_code = detect_res.lang
            
            full_lang_names = {
                'id': 'Indonesian', 'su': 'Sundanese', 'jv': 'Javanese', 
                'en': 'English', 'ja': 'Japanese', 'ko': 'Korean', 'tl': 'Tagalog'
            }
            lang_name = full_lang_names.get(lang_code, lang_code.title())

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

    final_input_model = prepare_text_for_ai(translated_display)

    with st.expander("View Lyrics", expanded=False):
        if lang_code == 'en':
            st.markdown("##### Lyrics (English)")
            st.text(text_display)
        else:
            c1, c2 = st.columns(2)
            with c1:
                st.markdown("##### Original Lyrics")
                st.text(text_display)
            with c2:
                st.markdown("##### English Translation")
                st.text(translated_display)
            
        st.divider()
        st.caption("Raw Input for AI Model (Dot-Separated):")
        st.code(final_input_model, language="text")

    with st.spinner("Calculating Scores..."):
        if not final_input_model.strip():
            st.error("Input text is empty after processing.")
            st.stop()
            
        # Run all 3 models
        rob_out = roberta_model(final_input_model[:1200])[0]
        dis_out = distilbert_model(final_input_model[:1200])[0]
        xlm_out = query_xlm_roberta(final_input_model[:1200])  # Use XLM-RoBERTa API

        rob_raw = {r['label']: r['score'] for r in rob_out}
        dis_raw = {r['label']: r['score'] for r in dis_out}
        
        # XLM-RoBERTa - already returns emotion labels
        xlm_raw = {}
        if xlm_out:
            for item in xlm_out:
                if 'label' in item and 'score' in item:
                    xlm_raw[item['label']] = float(item['score'])
        
        combined_scores = {}
        all_labels = set(rob_raw.keys()) | set(dis_raw.keys()) | set(xlm_raw.keys())
        
        for l in all_labels:
            combined_scores[l] = rob_raw.get(l, 0) + dis_raw.get(l, 0) + xlm_raw.get(l, 0)
        
        if 'neutral' in combined_scores: del combined_scores['neutral']
        if 'neutral' in rob_raw: del rob_raw['neutral']
        if 'neutral' in dis_raw: del dis_raw['neutral']
        if 'neutral' in xlm_raw: del xlm_raw['neutral']
        
        total_remaining = sum(combined_scores.values())
        
        results_data = []
        sum_rob = sum(rob_raw.values())
        sum_dis = sum(dis_raw.values())
        sum_xlm = sum(xlm_raw.values()) if xlm_raw else 1  # Avoid division by zero

        for label, raw_sum in combined_scores.items():
            s_hyb = raw_sum / total_remaining if total_remaining > 0 else 0
            s_rob = (rob_raw.get(label, 0) / sum_rob) if sum_rob > 0 else 0
            s_dis = (dis_raw.get(label, 0) / sum_dis) if sum_dis > 0 else 0
            s_xlm = (xlm_raw.get(label, 0) / sum_xlm) if sum_xlm > 0 and xlm_raw else 0
            
            results_data.append({'label': label.capitalize(), 'score': s_rob, 'model': 'RoBERTa'})
            results_data.append({'label': label.capitalize(), 'score': s_dis, 'model': 'DistilBERT'})
            results_data.append({'label': label.capitalize(), 'score': s_xlm, 'model': 'XLM-RoBERTa'})
            results_data.append({'label': label.capitalize(), 'score': s_hyb, 'model': 'Hybrid'})

        df = pd.DataFrame(results_data)
        
        top_sentiment_labels = df[df['model'] == 'Hybrid'].nlargest(6, 'score')['label'].tolist()
        df_filtered = df[df['label'].isin(top_sentiment_labels)]

    domain = ['RoBERTa', 'DistilBERT', 'XLM-RoBERTa', 'Hybrid']
    range_ = ['#3498db', '#e74c3c', '#f39c12', '#9b59b6']

    chart = alt.Chart(df_filtered).mark_bar().encode(
        x=alt.X('score', axis=alt.Axis(format='%', title='Confidence Score')),
        y=alt.Y('label', sort='-x', title=None),
        color=alt.Color('model', scale=alt.Scale(domain=domain, range=range_), legend=alt.Legend(title="Model", orient="bottom")),
        yOffset='model',
        tooltip=['label', 'model', alt.Tooltip('score', format='.1%')]
    ).properties(height=350)

    st.altair_chart(chart, use_container_width=True)
    
    st.markdown("#### Final Results Breakdown")
    try:
        top_rob = df[df['model'] == 'RoBERTa'].nlargest(1, 'score').iloc[0]
        top_dis = df[df['model'] == 'DistilBERT'].nlargest(1, 'score').iloc[0]
        top_xlm = df[df['model'] == 'XLM-RoBERTa'].nlargest(1, 'score').iloc[0]
        top_hyb = df[df['model'] == 'Hybrid'].nlargest(1, 'score').iloc[0]

        c1, c2, c3, c4 = st.columns(4)
        with c1:
            st.info("**RoBERTa**")
            st.metric(label=top_rob['label'], value=f"{top_rob['score']:.1%}")
        with c2:
            st.error("**DistilBERT**")
            st.metric(label=top_dis['label'], value=f"{top_dis['score']:.1%}")
        with c3:
            st.warning("**XLM-RoBERTa**")
            st.metric(label=top_xlm['label'], value=f"{top_xlm['score']:.1%}")
        with c4:
            st.success("**Hybrid**")
            st.metric(label=top_hyb['label'], value=f"{top_hyb['score']:.1%}")
    except:
        st.error("Error calculating top metrics.")

    st.caption(f"Status: {status_msg}")
