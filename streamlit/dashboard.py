import streamlit as st
import pandas as pd
import altair as alt
from transformers import pipeline
from googletrans import Translator
import requests
from bs4 import BeautifulSoup
import re
import time
import numpy as np

st.set_page_config(
    page_title="Personalify Analyst",
    page_icon="🎵",
    layout="centered"
)

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
                    else: all_lines.append("") 

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

@st.cache_resource
def load_models():
    roberta = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions", top_k=None)
    distilbert = pipeline("text-classification", model="joeddav/distilbert-base-uncased-go-emotions-student", top_k=None)
    return roberta, distilbert

@st.cache_resource
def get_translator():
    return Translator()

st.sidebar.header("Configuration")

default_token = st.secrets["GENIUS_ACCESS_TOKEN"] if "GENIUS_ACCESS_TOKEN" in st.secrets else ""
genius_token = st.sidebar.text_input(
    "Genius Access Token",
    value=default_token,
    type="password"
)
st.sidebar.divider()
input_method = st.sidebar.radio("Input Method:", ("Search via Genius API", "Manual Input"))

with st.spinner('Loading AI Engines...'):
    roberta_model, distilbert_model = load_models()
    translator = get_translator()

st.title("Personalify: Sentiment Analyst")
st.caption("Comparing **RoBERTa**, **DistilBERT**, and **Hybrid Consensus**.")
st.divider()

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
        with st.spinner("Searching Genius API..."):
            hits = search_genius_manual(search_query, genius_token)
            if hits:
                st.session_state.search_results = hits
                st.success(f"Found {len(hits)} results!")
            else: st.error("No results found.")

    if st.session_state.search_results:
        options = {f"{h['result']['full_title']}": h['result']['url'] for h in st.session_state.search_results}
        selected = st.selectbox("Select Song:", list(options.keys()))
        
        if st.button("Fetch & Analyze (Proxy Mode)"):
            target_url = options[selected]
            parts = selected.split(' by ')
            song_metadata = {'title': parts[0], 'artist': parts[1] if len(parts)>1 else "Unknown"}
            
            with st.spinner("Bypassing Genius via Google Proxy..."):
                raw_text = scrape_lyrics_proxy(target_url)
                
                if raw_text and len(raw_text) > 50:
                    final_lyrics = raw_text
                    st.toast("Lyrics fetched successfully!")
                else: 
                    st.error("Failed to fetch lyrics via Proxy. Content might be empty.")

elif input_method == "Manual Input":
    final_lyrics = st.text_area("Paste lyrics here...", height=200)
    if st.button("Analyze", type="primary"): pass

if final_lyrics:
    st.divider()
    st.subheader(f"Analysis: {song_metadata['title']}")

    text_to_analyze = final_lyrics
    detected_lang = "en"
    
    with st.spinner('Checking Language...'):
        try:
            sample = final_lyrics[:2000]
            if translator.detect(sample).lang != 'en':
                text_to_analyze = translator.translate(sample, dest='en').text
                detected_lang = "Translated to EN"
        except: pass
    
    with st.expander("View Cleaned Lyrics"):
        st.text(text_to_analyze)

    # INFERENCE
    with st.spinner("Calculating Scores..."):
        rob_out = roberta_model(text_to_analyze[:2000])[0]
        dis_out = distilbert_model(text_to_analyze[:2000])[0]
        
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
        top_emotions = df[df['model'] == 'Hybrid'].nlargest(6, 'score')['label'].tolist()
        df_filtered = df[df['label'].isin(top_emotions)]

    domain = ['RoBERTa', 'DistilBERT', 'Hybrid']
    range_ = ['#3498db', '#e74c3c', '#9b59b6']

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
        top_hyb = df[df['model'] == 'Hybrid'].nlargest(1, 'score').iloc[0]

        c1, c2, c3 = st.columns(3)
        with c1:
            st.info("**RoBERTa**")
            st.metric(label=top_rob['label'], value=f"{top_rob['score']:.1%}")
        with c2:
            st.error("**DistilBERT**")
            st.metric(label=top_dis['label'], value=f"{top_dis['score']:.1%}")
        with c3:
            st.success("**Hybrid**")
            st.metric(label=top_hyb['label'], value=f"{top_hyb['score']:.1%}")
    except:
        st.error("Error calculating top metrics.")

    st.caption(f"Language Status: {detected_lang}")