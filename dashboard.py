import streamlit as st
import pandas as pd
import altair as alt
from transformers import pipeline
from googletrans import Translator
import requests
from bs4 import BeautifulSoup
import re
import numpy as np

# --- PAGE CONFIGURATION ---
st.set_page_config(
    page_title="Personalify Analyst",
    page_icon="🎵",
    layout="centered"
)

# --- CLEANING FUNCTION ---
def clean_lyrics(text):
    if not text: return ""
    text = re.sub(r"^.*?Lyrics", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"\d+\s*Contributors", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\d*Embed$", "", text, flags=re.IGNORECASE)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)

# --- SCRAPING FUNCTION ---
def search_genius_manual(query, token):
    base_url = "https://api.genius.com"
    headers = {'Authorization': f'Bearer {token}'}
    try:
        response = requests.get(f"{base_url}/search", params={'q': query}, headers=headers)
        return response.json()['response']['hits'] if response.status_code == 200 else None
    except: return None

def scrape_lyrics_from_url(url):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36'}
    try:
        page = requests.get(url, headers=headers)
        html = BeautifulSoup(page.text, 'html.parser')
        lyrics_div = html.find('div', class_=lambda x: x and 'Lyrics__Container' in x)
        if not lyrics_div: lyrics_div = html.find('div', class_='lyrics')
        
        if lyrics_div:
            text = lyrics_div.get_text(separator='\n')
        else:
            containers = html.find_all('div', {'data-lyrics-container': 'true'})
            text = "\n".join([c.get_text(separator='\n') for c in containers])
        return clean_lyrics(text)
    except: return None

# --- LOAD MODELS ---
@st.cache_resource
def load_models():
    roberta = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions", top_k=None)
    distilbert = pipeline("text-classification", model="joeddav/distilbert-base-uncased-go-emotions-student", top_k=None)
    return roberta, distilbert

@st.cache_resource
def get_translator():
    return Translator()

# --- SIDEBAR ---
st.sidebar.header("Configuration")
genius_token = st.sidebar.text_input("Genius Access Token", type="password")
st.sidebar.divider()
input_method = st.sidebar.radio("Input Method:", ("Search via Genius API", "Manual Input"))

# Init Models
with st.spinner('Loading AI Engines...'):
    roberta_model, distilbert_model = load_models()
    translator = get_translator()

# --- MAIN UI ---
st.title("Personalify: Sentiment Analyst")
st.caption("Comparing **RoBERTa**, **DistilBERT**, and **Hybrid Consensus**.")
st.divider()

# --- INPUT LOGIC ---
final_lyrics = ""
song_metadata = {"title": "Unknown Track", "artist": "Unknown Artist"}

if input_method == "Search via Genius API":
    col1, col2 = st.columns([3, 1])
    with col1:
        search_query = st.text_input("Enter Artist & Song Title", placeholder="e.g. The Beatles - Blackbird")
    with col2:
        st.write("")
        st.write("")
        search_btn = st.button("Search", type="primary", use_container_width=True)

    if 'search_results' not in st.session_state: st.session_state.search_results = []
    
    if search_btn and genius_token:
        with st.spinner("Searching..."):
            hits = search_genius_manual(search_query, genius_token)
            if hits:
                st.session_state.search_results = hits
                st.success(f"Found {len(hits)} results!")
            else: st.error("No results found.")

    if st.session_state.search_results:
        options = {f"{h['result']['full_title']}": h['result']['url'] for h in st.session_state.search_results}
        selected = st.selectbox("Select Song:", list(options.keys()))
        
        if st.button("Fetch & Analyze"):
            with st.spinner("Scraping & Cleaning Lyrics..."):
                raw_text = scrape_lyrics_from_url(options[selected])
                if raw_text and len(raw_text) > 50:
                    final_lyrics = raw_text
                    parts = selected.split(' by ')
                    song_metadata = {'title': parts[0], 'artist': parts[1] if len(parts)>1 else "Unknown"}
                else: st.error("Failed to fetch lyrics.")

elif input_method == "Manual Input":
    final_lyrics = st.text_area("Paste lyrics here...", height=200)
    if st.button("Analyze", type="primary"): pass

# --- ANALYSIS ENGINE ---
if final_lyrics:
    st.divider()
    st.subheader(f"Analysis: {song_metadata['title']}")
    
    # 1. TRANSLATION
    text_to_analyze = final_lyrics
    detected_lang = "en"
    
    with st.spinner('Translating...'):
        try:
            sample = final_lyrics[:2000]
            if translator.detect(sample).lang != 'en':
                text_to_analyze = translator.translate(sample, dest='en').text
                detected_lang = "Translated to EN"
        except: pass
    
    with st.expander("View Cleaned Lyrics"):
        st.text(text_to_analyze)

    # 2. INFERENCE
    with st.spinner("Calculating Scores..."):
        # Run Models
        rob_out = roberta_model(text_to_analyze[:1500])[0]
        dis_out = distilbert_model(text_to_analyze[:1500])[0]
        
        rob_scores = {r['label']: r['score'] for r in rob_out}
        dis_scores = {r['label']: r['score'] for r in dis_out}
        
        results_data = []
        all_labels = set(rob_scores.keys()) | set(dis_scores.keys())
        
        for label in all_labels:
            s_rob = rob_scores.get(label, 0)
            s_dis = dis_scores.get(label, 0)
            s_hyb = (s_rob + s_dis) / 2
            
            results_data.append({'label': label.capitalize(), 'score': s_rob, 'model': 'RoBERTa'})
            results_data.append({'label': label.capitalize(), 'score': s_dis, 'model': 'DistilBERT'})
            results_data.append({'label': label.capitalize(), 'score': s_hyb, 'model': 'Hybrid'})

        df = pd.DataFrame(results_data)
        
        # Filter Top 6 Emotion (Biar grafik ga penuh)
        top_emotions = df[df['model'] == 'Hybrid'].nlargest(6, 'score')['label'].tolist()
        df_filtered = df[df['label'].isin(top_emotions)]

    # 3. VISUALIZATION (CHART GEDE)
    domain = ['RoBERTa', 'DistilBERT', 'Hybrid']
    range_ = ['#3498db', '#e74c3c', '#9b59b6']

    chart = alt.Chart(df_filtered).mark_bar().encode(
        x=alt.X('score', axis=alt.Axis(format='%', title='Confidence Score')),
        y=alt.Y('label', sort='-x', title=None),
        color=alt.Color('model', scale=alt.Scale(domain=domain, range=range_), legend=alt.Legend(title="Model", orient="bottom")),
        yOffset='model',
        tooltip=['label', 'model', alt.Tooltip('score', format='.1%')]
    ).properties(
        height=350 # SIZE UDAH DIPERBESAR (Sewajarnya)
    )

    st.altair_chart(chart, use_container_width=True)
    
    # 4. METRIC CARDS (3 KOLOM: RoBERTa | DistilBERT | Hybrid)
    st.markdown("#### Final Results Breakdown")
    
    # Ambil Top 1 dari masing-masing model
    top_rob = df[df['model'] == 'RoBERTa'].nlargest(1, 'score').iloc[0]
    top_dis = df[df['model'] == 'DistilBERT'].nlargest(1, 'score').iloc[0]
    top_hyb = df[df['model'] == 'Hybrid'].nlargest(1, 'score').iloc[0]

    c1, c2, c3 = st.columns(3)
    
    with c1:
        st.info("**RoBERTa** (Teacher)")
        st.metric(label=top_rob['label'], value=f"{top_rob['score']:.1%}")
    
    with c2:
        st.error("**DistilBERT** (Student)")
        st.metric(label=top_dis['label'], value=f"{top_dis['score']:.1%}")

    with c3:
        st.success("**Hybrid** (Consensus)")
        st.metric(label=top_hyb['label'], value=f"{top_hyb['score']:.1%}")

    st.caption(f"Language Status: {detected_lang}")