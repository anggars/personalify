const artistInput = document.getElementById('artistInput');
const searchBtn = document.getElementById('searchBtn');
const artistList = document.getElementById('artistList');
const songSection = document.getElementById('songSection');
const songList = document.getElementById('songList');
const analysisResult = document.getElementById('analysisResult');
const resultContent = document.getElementById('resultContent');
let debounceTimer;
const getSpinnerHtml = (text) => `
    <div class="loading-state-container">
        <svg class="spinner" viewBox="0 0 50 50">
            <circle class="path" cx="25" cy="25" r="20" fill="none"></circle>
        </svg>
        <span>${text}</span>
    </div>
`;
document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && 
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_')) {
        e.preventDefault();
    }
});
function updateGlow(e, el) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined) return; 
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * 100;
    const y = (clientY - rect.top) / el.clientHeight * 100; 
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
};
function setLoading(isLoading) {
    if (isLoading) {
        searchBtn.classList.add('loading');
        artistInput.disabled = true;
    } else {
        searchBtn.classList.remove('loading');
        artistInput.disabled = false;
        artistInput.blur();
    }
}
function createArtistCard(artist){
    const card=document.createElement('div');
    card.className='artist-card';
    const imgUrl=artist.image||artist.image_url||'https://via.placeholder.com/150?text=No+Image';
    card.innerHTML=`<img src="${imgUrl}" class="artist-img"><div class="artist-name-wrapper"><span class="artist-name">${artist.name}</span></div>`;
    card.onclick=()=>{
        artistInput.value=artist.name;
        updateSearchButtonState(true);
        loadSongs(artist.id,artist.name);
    };
    card.addEventListener('mousemove',(e)=>updateGlow(e,card));
    card.addEventListener('touchstart',(e)=>updateGlow(e,card));
    card.addEventListener('touchmove',(e)=>updateGlow(e,card));
    document.fonts.ready.then(()=>{
        setTimeout(()=>{
            const wrapper=card.querySelector('.artist-name-wrapper');
            const textEl=card.querySelector('.artist-name');
            if(wrapper&&textEl){
                if(textEl.scrollWidth>wrapper.clientWidth){
                    wrapper.classList.add('masked');
                    const track=document.createElement('div');
                    track.className='artist-marquee-track';
                    const originalText=textEl.cloneNode(true);
                    const cloneText=textEl.cloneNode(true);
                    const spacer1=document.createElement("span");
                    spacer1.className="artist-spacer";
                    const spacer2=document.createElement("span");
                    spacer2.className="artist-spacer";
                    wrapper.innerHTML='';
                    track.appendChild(originalText);
                    track.appendChild(spacer1);
                    track.appendChild(cloneText);
                    track.appendChild(spacer2);
                    wrapper.appendChild(track);
                    const singleSetWidth=track.scrollWidth/2;
                    const speed=30;
                    const duration=Math.max(singleSetWidth/speed,5);
                    track.style.setProperty('--duration',`${duration}s`);
                }
            }
        },100);
    });
    return card;
}
function updateSearchButtonState(hasText){
    const btnText=searchBtn.querySelector('.button-text')||searchBtn;
    if(hasText){
        btnText.textContent="Clear Search";
        searchBtn.classList.add('button-clear');
        searchBtn.onclick=()=>{
            artistInput.value='';
            artistList.innerHTML='';
            artistList.style.display='none';
            songSection.style.display='none';
            analysisResult.style.display='none';
            updateSearchButtonState(false);
            artistInput.focus();
        };
    }else{
        btnText.textContent="Search Artist";
        searchBtn.classList.remove('button-clear');
        searchBtn.onclick=searchArtist;
    }
}
async function searchArtist(){
    const query=artistInput.value.trim();
    if(!query){
        artistList.style.display='grid';
        artistList.innerHTML='<p class="status-msg error">Please enter an artist name first!</p>';
        return;
    }
    songSection.style.display='none';
    analysisResult.style.display='none';
    artistList.innerHTML='';
    artistList.style.display='grid';
    setLoading(true);
    try{
        const res=await fetch(`/api/genius/search-artist?q=${encodeURIComponent(query)}`);
        const data=await res.json();
        if(data.artists.length===0){
            artistList.innerHTML='<p class="status-msg error">No artist found.</p>';
        }else{
            data.artists.forEach(artist=>{
                const card=createArtistCard(artist);
                artistList.appendChild(card);
            });
        }
    }catch(err){
        console.error(err);
        artistList.innerHTML='<p class="status-msg error">Error searching artist.</p>';
    }finally{
        setLoading(false);
    }
}
async function fetchSuggestions(query) {
    try {
        const res = await fetch(`/api/genius/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderSuggestions(data.results);
    } catch (e) {
        console.error("Autocomplete error:", e);
    }
}
async function loadSongs(artistId, artistName) {
    const selectedArtistEl = document.getElementById('selectedArtistName');
    selectedArtistEl.innerHTML = `
        <div class="track-title-wrapper" id="selectedArtistWrapper" style="margin-bottom: 0;">
            <div class="track-marquee-track" id="selectedArtistTrack">
                <span class="track-title-text" style="font-size: 1.25rem; color: var(--primary);">${artistName}</span>
            </div>
        </div>
    `;

    setTimeout(() => {
        const wrapper = document.getElementById('selectedArtistWrapper');
        const track = document.getElementById('selectedArtistTrack');
        const textEl = track ? track.querySelector('.track-title-text') : null;
        if (wrapper && track && textEl) {
            if (textEl.scrollWidth > wrapper.clientWidth) {
                wrapper.classList.add('masked');
                track.classList.add('animate');
                const clone = textEl.cloneNode(true);
                const spacer1 = document.createElement('span'); spacer1.className = 'track-title-spacer';
                const spacer2 = document.createElement('span'); spacer2.className = 'track-title-spacer';
                track.appendChild(spacer1);
                track.appendChild(clone);
                track.appendChild(spacer2);
                const duration = (textEl.scrollWidth * 2) / 50; 
                track.style.setProperty('--duration', `${Math.max(duration, 10)}s`);
            }
        }
    }, 100);
    artistList.style.display = 'none';   
    songSection.style.display = 'block'; 
    analysisResult.style.display = 'none'; 
    songList.innerHTML = '<div style="grid-column: 1/-1;">' + getSpinnerHtml("Loading songs...") + '</div>';
    try {
        const res = await fetch(`/api/genius/artist-songs/${artistId}`);
        const data = await res.json();
        songList.innerHTML = '';
        if (!data.songs || data.songs.length === 0) {
             songList.innerHTML = '<div class="status-msg neutral">No songs found.</div>';
             return;
        }
        data.songs.forEach(song => {
            const btn = document.createElement('div');
            btn.className = 'song-btn';
            btn.dataset.songId = song.id; 
            const imgUrl = song.image || 'https://via.placeholder.com/50?text=Music';
            let metaText = '';
            if (song.album && song.date) {
                metaText = `${song.album} • ${song.date}`;
            } else if (song.album) {
                metaText = song.album;
            } else if (song.date) {
                metaText = song.date;
            }
            btn.innerHTML = `
                <img src="${imgUrl}" class="song-thumb">
                <div style="display:flex; flex-direction:column; justify-content:center; overflow:hidden; flex:1;">
                    <div class="song-title-wrapper">
                        <span class="song-title">${song.title}</span>
                    </div>
                    ${metaText ? `<div class="album-info">${metaText}</div>` : ''}
                </div>
            `;
            btn.onclick = function() { 
                analyzeSong(song.id, this); 
            };
            btn.addEventListener('mousemove', (e) => updateGlow(e, btn));
            btn.addEventListener('touchstart', (e) => updateGlow(e, btn));
            btn.addEventListener('touchmove', (e) => updateGlow(e, btn));
            songList.appendChild(btn);
            setTimeout(() => {
                const wrapper = btn.querySelector('.song-title-wrapper');
                const titleEl = btn.querySelector('.song-title');
                if (!wrapper || !titleEl) return;
                const wrapperWidth = wrapper.clientWidth;
                const textWidth = titleEl.scrollWidth;
                if (textWidth <= wrapperWidth) {
                    wrapper.classList.remove("masked");
                    return;
                }
                wrapper.classList.add("masked");
                const track = document.createElement("div");
                track.classList.add("marquee-track");
                const originalTitle = titleEl.cloneNode(true);
                const cloneTitle = titleEl.cloneNode(true);
                const spacer1 = document.createElement("span");
                spacer1.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;"; 
                spacer1.style.display = "inline-block";
                const spacer2 = document.createElement("span");
                spacer2.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;"; 
                spacer2.style.display = "inline-block";
                wrapper.innerHTML = "";
                track.appendChild(originalTitle);
                track.appendChild(spacer1);
                track.appendChild(cloneTitle);
                track.appendChild(spacer2);
                wrapper.appendChild(track);
                const singleSetWidth = track.scrollWidth / 2;
                const duration = singleSetWidth / 30; 
                track.style.setProperty("--duration", duration + "s");
            }, 50);
        });
    } catch (err) {
        console.error(err);
        songList.innerHTML = '<p class="status-msg error">Error loading songs.</p>';
    }
}
async function analyzeSong(songId, clickedElement) {
    const allSongs = document.querySelectorAll('.song-btn');
    allSongs.forEach(btn => btn.classList.remove('active'));
    if (clickedElement) clickedElement.classList.add('active');
    analysisResult.style.display = 'block';
    resultContent.innerHTML = getSpinnerHtml("Fetching lyrics & analyzing vibe...");
    resultContent.scrollIntoView({behavior: 'smooth'});
    try {
        const res = await fetch(`/api/genius/lyrics/${songId}`);
        if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
        const data = await res.json();
        if (!data.lyrics) throw new Error("Lyrics content is empty.");
        const processedLyrics = data.lyrics
            .split(/\r?\n/) 
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return '<div class="lyric-spacer"></div>';
                return `<p class="lyric-line">${trimmed}</p>`;
            })
            .join('');
        let html = `
            <div class="track-header">
                <div class="track-title-wrapper" id="resultTitleWrapper">
                    <div class="track-marquee-track" id="resultTitleTrack">
                        <h2 class="track-title-text">${data.track_info.title}</h2>
                    </div>
                </div>
                <div class="track-title-wrapper" id="resultArtistWrapper" style="margin-bottom: 0;">
                    <div class="track-marquee-track" id="resultArtistTrack">
                        <p class="track-artist" style="margin:0; white-space:nowrap;">${data.track_info.artist}</p>
                    </div>
                </div>
            </div>
            <div class="lyrics-box">${processedLyrics}</div>
        `;
        if (data.emotion_analysis && data.emotion_analysis.emotions) {
            const emotions = data.emotion_analysis.emotions.slice(0, 5);
            const maxScore = Math.max(...emotions.map(e => e.score));
            html += `<h3 style="border-top:1px solid #333; text-align:center; padding-top:15px; color:#1DB954; margin-bottom:15px; font-size: 1.25rem;">Emotion Results:</h3>`;
            html += `<div class="emotion-bars-group">`;
            emotions.forEach(e => {
                html += `
                    <div class="emotion-bar-row">
                        <span class="emotion-label">${e.label}</span>
                        <div class="emotion-bar-bg">
                            <div class="emotion-bar" style="width:${(e.score/maxScore*100).toFixed(1)}%"></div>
                        </div>
                        <span class="emotion-score">${(e.score * 100).toFixed(1)}%</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        resultContent.innerHTML = html;
        setTimeout(() => {
            const wrapper = document.getElementById('resultTitleWrapper');
            const track = document.getElementById('resultTitleTrack');
            const textEl = track ? track.querySelector('.track-title-text') : null;
            if (wrapper && track && textEl) {
                const wrapperWidth = wrapper.clientWidth;
                const textWidth = textEl.scrollWidth;
                if (textWidth > wrapperWidth) {
                    wrapper.classList.add('masked');
                    track.classList.add('animate');
                    const clone = textEl.cloneNode(true);
                    const spacer1 = document.createElement('span');
                    spacer1.className = 'track-title-spacer';
                    const spacer2 = document.createElement('span');
                    spacer2.className = 'track-title-spacer';
                    track.appendChild(spacer1);
                    track.appendChild(clone);
                    track.appendChild(spacer2);
                    const duration = (textWidth * 2) / 50; 
                    track.style.setProperty('--duration', `${Math.max(duration, 15)}s`);
                }
            }
            const artistWrapper = document.getElementById('resultArtistWrapper');
            const artistTrack = document.getElementById('resultArtistTrack');
            const artistTextEl = artistTrack ? artistTrack.querySelector('.track-artist') : null;
            if (artistWrapper && artistTrack && artistTextEl) {
                if (artistTextEl.scrollWidth > artistWrapper.clientWidth) {
                    artistWrapper.classList.add('masked');
                    artistTrack.classList.add('animate');
                    const clone = artistTextEl.cloneNode(true);
                    const spacer1 = document.createElement('span'); spacer1.className = 'track-title-spacer';
                    const spacer2 = document.createElement('span'); spacer2.className = 'track-title-spacer';
                    artistTrack.appendChild(spacer1);
                    artistTrack.appendChild(clone);
                    artistTrack.appendChild(spacer2);
                    const duration = (artistTextEl.scrollWidth * 2) / 50; 
                    artistTrack.style.setProperty('--duration', `${Math.max(duration, 12)}s`);
                }
            }
        }, 100);
    } catch (err) {
        console.error("Lyrics Error:", err);
        resultContent.innerHTML = '<p class="status-msg error">Failed to fetch lyrics. Please try again.</p>';
    }
}
function typeEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        let index = 0;
        let currentHtml = '';
        element.style.visibility = 'visible';
        function typeWriter() {
            if (index < text.length) {
                let char = text.charAt(index);
                if (char === '<') {
                    let tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        currentHtml += text.substring(index, tagEnd + 1);
                        index = tagEnd + 1;
                    } else {
                        currentHtml += char; index++;
                    }
                } else {
                    currentHtml += char; index++;
                }
                element.innerHTML = currentHtml + '<span class="typing-cursor"></span>';
                setTimeout(typeWriter, speed);
            } else {
                element.innerHTML = currentHtml;
                resolve();
            }
        }
        typeWriter();
    });
}
document.addEventListener('DOMContentLoaded', async function() {
    const titleEl = document.querySelector('header h1');
    const subtitleEl = document.querySelector('header p.subtitle');
    const footerEl = document.querySelector('footer');
    if (searchBtn) {
        searchBtn.addEventListener('mousemove', (e) => updateGlow(e, searchBtn));
        searchBtn.addEventListener('mouseleave', () => {
        });
        searchBtn.addEventListener('touchstart', (e) => updateGlow(e, searchBtn));
        searchBtn.addEventListener('touchmove', (e) => updateGlow(e, searchBtn));
        searchBtn.addEventListener('touchend', () => {
        });
    }
    if (titleEl && subtitleEl) {
        const subtitleHtml = subtitleEl.innerHTML;
        subtitleEl.innerHTML = ''; 
        titleEl.style.visibility = 'visible';
        subtitleEl.style.visibility = 'visible';
        const containerEl = document.querySelector('.container');
        if (containerEl) {
            containerEl.style.visibility = 'visible';
            containerEl.style.opacity = '0'; 
            containerEl.style.animation = 'fadeInUp 1s ease-out forwards';
        }
        setTimeout(() => {
            if (footerEl) footerEl.classList.add('fade-in');
        }, 100);
        await typeEffect(subtitleEl, subtitleHtml, 30);
    }
    const techPrefix = document.getElementById('tech-prefix');
    const techLink = document.getElementById('tech-link');
    const techStack = [
        { name: "Genius API", url: "https://genius.com/developers", class: "tech-genius" },
        { name: "Hugging Face", url: "https://huggingface.co/", class: "tech-huggingface" }
    ];
    let techLoop = 0;
    let isDeleting = false;
    let currentName = '';
    const typeSpeed = 80; 
    const deleteSpeed = 40; 
    const pauseTime = 2500; 
    function typeTechFooter() {
        if (!techLink) return;
        const i = techLoop % techStack.length;
        const fullName = techStack[i].name;
        const currentData = techStack[i];
        if (isDeleting) {
            currentName = fullName.substring(0, currentName.length - 1);
        } else {
            currentName = fullName.substring(0, currentName.length + 1);
        }
        techLink.textContent = currentName;
        let delta = isDeleting ? deleteSpeed : typeSpeed;
        if (!isDeleting && currentName === fullName) {
            delta = pauseTime;
            isDeleting = true;
            techLink.href = currentData.url;
            if (currentData.class === 'tech-huggingface') {
                techLink.classList.add('hf-mode');
            } else {
                techLink.classList.remove('hf-mode');
            }
        } else if (isDeleting && currentName === '') {
            isDeleting = false;
            techLoop++;
            delta = 500;
        }
        setTimeout(typeTechFooter, delta);
    }
    typeTechFooter();
});
artistInput.addEventListener('input',function(){
    const query=this.value.trim();
    updateSearchButtonState(query.length>0);
    clearTimeout(debounceTimer);
    if(!query){
        artistList.innerHTML='';
        artistList.style.display='none';
        return;
    }
    debounceTimer=setTimeout(async()=>{
        if(!artistInput.value.trim())return;
        try{
            const res=await fetch(`/api/genius/autocomplete?q=${encodeURIComponent(query)}`);
            const data=await res.json();
            if(!artistInput.value.trim()){
                artistList.innerHTML='';
                artistList.style.display='none';
                return;
            }
            artistList.innerHTML='';
            if(data.results.length>0){
                artistList.style.display='grid';
                songSection.style.display='none';
                analysisResult.style.display='none';
                data.results.forEach(artist=>{
                    const card=createArtistCard(artist);
                    artistList.appendChild(card);
                });
            }else{
                artistList.style.display='none';
            }
        }catch(e){console.error(e);}
    },300);
});
searchBtn.addEventListener('click', searchArtist);
artistInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') searchArtist() });
function renderSuggestions(artists) {
    artistList.innerHTML = ''; 
    if (!artists || artists.length === 0) {
        artistList.style.display = 'none';
        return;
    }
    artistList.style.display = 'grid';
    songSection.style.display = 'none';
    analysisResult.style.display = 'none';
    artists.forEach(artist => {
        const card = document.createElement('div');
        card.className = 'artist-card';
        const imgUrl = artist.image_url || 'https://via.placeholder.com/150?text=No+Image';
        card.innerHTML = `
            <img src="${imgUrl}" class="artist-img">
            <div class="artist-name-wrapper">
                <span class="artist-name">${artist.name}</span>
            </div>
        `;
        card.onclick = () => {
            artistInput.value = '';
            loadSongs(artist.id, artist.name);
        };
        card.addEventListener('mousemove', (e) => updateGlow(e, card));
        card.addEventListener('touchstart', (e) => updateGlow(e, card));
        card.addEventListener('touchmove', (e) => updateGlow(e, card));
        artistList.appendChild(card);
    });
}