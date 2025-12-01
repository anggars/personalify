const artistInput = document.getElementById('artistInput');
const searchBtn = document.getElementById('searchBtn');
const artistList = document.getElementById('artistList');
const songSection = document.getElementById('songSection');
const songList = document.getElementById('songList');
const analysisResult = document.getElementById('analysisResult');
const resultContent = document.getElementById('resultContent');

// Helper: SVG Spinner HTML
const getSpinnerHtml = (text) => `
    <div class="loading-state-container">
        <svg class="spinner" viewBox="0 0 50 50">
            <circle class="path" cx="25" cy="25" r="20" fill="none"></circle>
        </svg>
        <span>${text}</span>
    </div>
`;

// --- 1. Helper: Loading State pada Tombol ---
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

// --- 2. Cari Artis ---
async function searchArtist() {
    const query = artistInput.value.trim();
    
    // 1. VALIDASI: Jika kosong, kasih peringatan merah
    if (!query) {
        artistList.style.display = 'grid'; // Pastikan container muncul
        artistList.innerHTML = '<p class="status-msg error">Please enter an artist name first!</p>';
        return;
    }

    songSection.style.display = 'none';
    analysisResult.style.display = 'none';
    
    artistList.innerHTML = ''; 
    artistList.style.display = 'grid'; 

    setLoading(true);

    try {
        const res = await fetch(`/api/genius/search-artist?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.artists.length === 0) {
            // Gunakan class .status-msg error
            artistList.innerHTML = '<p class="status-msg error">No artist found.</p>';
        } else {
            data.artists.forEach(artist => {
                const card = document.createElement('div');
                card.className = 'artist-card';
                const imgUrl = artist.image || 'https://via.placeholder.com/150?text=No+Image';
                card.innerHTML = `
                    <img src="${imgUrl}" class="artist-img">
                    <div style="font-weight:bold; font-size:0.9rem;">${artist.name}</div>
                `;
                card.onclick = () => loadSongs(artist.id, artist.name);
                artistList.appendChild(card);
            });
        }
    } catch (err) {
        console.error(err);
        artistList.innerHTML = '<p class="status-msg error">Error searching artist.</p>';
    } finally {
        setLoading(false);
    }
}

// --- 3. Load Lagu ---
async function loadSongs(artistId, artistName) {
    document.getElementById('selectedArtistName').innerText = `${artistName}`;
    artistList.style.display = 'none'; 
    songSection.style.display = 'block';
    
    analysisResult.style.display = 'none';
    
    // Gunakan class .status-msg neutral (bukan error) untuk loading container wrapper
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
            
            // LOGIKA TAMPILAN ALBUM
            // Kalau ada album, tampilkan "Album • Tanggal"
            // Kalau gak ada album (null), tampilkan "Tanggal" aja (atau kosong kalau tanggal juga gak ada)
            let metaText = '';
            if (song.album && song.date) {
                metaText = `${song.album} • ${song.date}`;
            } else if (song.album) {
                metaText = song.album;
            } else if (song.date) {
                metaText = song.date; // Cuma tanggal (biasanya Single)
            }

            // HTML STRUKTUR BARU (Support Marquee)
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
            
            songList.appendChild(btn);
            setTimeout(() => {
                const wrapper = btn.querySelector('.song-title-wrapper');
                const titleEl = btn.querySelector('.song-title');

                if (!wrapper || !titleEl) return;

                const wrapperWidth = wrapper.clientWidth;
                const textWidth = titleEl.scrollWidth;

                // --- 1️⃣: Jika teks TIDAK overflow → ga usah running text & tanpa mask
                if (textWidth <= wrapperWidth) {
                    wrapper.classList.remove("masked");
                    return;
                }

                // --- 2️⃣: Kalau overflow → aktifkan mask biar fade mulus di ujung
                wrapper.classList.add("masked");

                // Buat track container
                const track = document.createElement("div");
                track.classList.add("marquee-track");

                const clone = titleEl.cloneNode(true);

                // Spacer (jarak)
                const spacer = document.createElement("span");
                spacer.innerHTML = "&nbsp;&nbsp;&nbsp;";
                spacer.style.display = "inline-block";

                wrapper.innerHTML = "";
                track.appendChild(titleEl);
                track.appendChild(spacer);
                track.appendChild(clone);
                wrapper.appendChild(track);

                // Hitung durasi animasi
                const scrollWidth = track.scrollWidth / 2;
                const duration = scrollWidth / 45;

                track.style.setProperty("--duration", duration + "s");
                track.style.setProperty("--scroll-width", scrollWidth + "px");
            }, 50);
        });
    } catch (err) {
        songList.innerHTML = '<p class="status-msg error">Error loading songs.</p>';
    }
}

// --- 4. Analisis Lagu (FIXED: Marquee + Lirik Rapi) ---
async function analyzeSong(songId, clickedElement) {
    // 1. Reset UI & Loading
    const allSongs = document.querySelectorAll('.song-btn');
    allSongs.forEach(btn => btn.classList.remove('active'));
    if (clickedElement) clickedElement.classList.add('active');

    analysisResult.style.display = 'block';
    resultContent.innerHTML = getSpinnerHtml("Fetching lyrics & analyzing vibe...");
    resultContent.scrollIntoView({behavior: 'smooth'});

    try {
        // 2. Fetch Data
        const res = await fetch(`/api/genius/lyrics/${songId}`);
        if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
        const data = await res.json();

        if (!data.lyrics) throw new Error("Lyrics content is empty.");

        // 3. Proses Lirik (Biar Enter Kebaca & Bisa Scroll Snap)
        // Pakai Regex /\r?\n/ biar aman untuk semua jenis Enter
        const processedLyrics = data.lyrics
            .split(/\r?\n/) 
            .map(line => {
                const trimmed = line.trim();
                // Kalau baris kosong, kasih spacer
                if (!trimmed) return '<div class="lyric-spacer"></div>';
                // Kalau ada isi, bungkus <p> biar bisa di-snap
                return `<p class="lyric-line">${trimmed}</p>`;
            })
            .join('');

        // 4. Render HTML (HANYA SATU JUDUL & SATU LIRIK)
        let html = `
            <div class="track-header">
                <div class="track-title-wrapper" id="resultTitleWrapper">
                    <div class="track-marquee-track" id="resultTitleTrack">
                        <h2 class="track-title-text">${data.track_info.title}</h2>
                    </div>
                </div>
                
                <p class="track-artist">${data.track_info.artist}</p>
            </div>
            
            <div class="lyrics-box">${processedLyrics}</div>
        `;

        // 5. Tambah Grafik Emosi (Kalau Ada)
        if (data.emotion_analysis && data.emotion_analysis.emotions) {
            const emotions = data.emotion_analysis.emotions.slice(0, 5);
            const maxScore = Math.max(...emotions.map(e => e.score));
            
            html += `<h3 style="border-top:1px solid #333; text-align:center; padding-top:15px; color:#1DB954; margin-bottom:15px; font-size: 1.2rem;">Emotion Results:</h3>`;
            html += `<div class="emotion-bars-group">`;
            emotions.forEach(e => {
                html += `
                    <div class="emotion-bar-row">
                        <span class="emotion-label">${e.label}</span>
                        <div class="emotion-bar-bg">
                            <div class="emotion-bar" style="width:${(e.score/maxScore*100).toFixed(1)}%"></div>
                        </div>
                        <span class="emotion-score">${e.score.toFixed(3)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Masukkan ke layar
        resultContent.innerHTML = html;

        // 6. Jalankan Logika Marquee (Fixed: Unlimited Loop & No Gap)
        setTimeout(() => {
            const wrapper = document.getElementById('resultTitleWrapper');
            const track = document.getElementById('resultTitleTrack');
            const textEl = track ? track.querySelector('.track-title-text') : null;

            if (wrapper && track && textEl) {
                const wrapperWidth = wrapper.clientWidth;
                const textWidth = textEl.scrollWidth;

                // Cek: Apakah judul lebih panjang dari wadahnya?
                if (textWidth > wrapperWidth) {
                    wrapper.classList.add('masked');
                    track.classList.add('animate');

                    // --- TEKNIK UNLIMITED LOOP ---
                    // Struktur harus: [Teks] [Spacer] [Teks] [Spacer]
                    // Nanti kita geser 50%, jadi pas Teks 1 ilang, Teks 2 pas gantiin posisinya.
                    
                    const clone = textEl.cloneNode(true);
                    
                    const spacer1 = document.createElement('span');
                    spacer1.className = 'track-title-spacer';
                    
                    const spacer2 = document.createElement('span');
                    spacer2.className = 'track-title-spacer';
                    
                    // Susun urutannya: Asli + Spacer1 + Kloningan + Spacer2
                    track.appendChild(spacer1);
                    track.appendChild(clone);
                    track.appendChild(spacer2);

                    // Hitung durasi (makin panjang makin santai jalannya)
                    // Kita kali 2 karena sekarang track-nya jadi 2x lipat panjangnya
                    const duration = (textWidth * 2) / 50; 
                    track.style.setProperty('--duration', `${Math.max(duration, 15)}s`);
                }
            }
        }, 100);

    } catch (err) {
        console.error("Lyrics Error:", err);
        resultContent.innerHTML = '<p class="status-msg error">Failed to fetch lyrics. Please try again.</p>';
    }
}

// --- 5. ANIMASI HEADER & FOOTER ---

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
    
    if (titleEl && subtitleEl) {
        const titleText = titleEl.textContent;
        const subtitleHtml = subtitleEl.innerHTML; // PENTING: Ambil innerHTML biar link kebawa
        
        // Kosongkan dulu
        titleEl.innerHTML = '';
        subtitleEl.innerHTML = ''; 
        
        // Pastikan elemen visible sebelum ngetik
        titleEl.style.visibility = 'visible';
        subtitleEl.style.visibility = 'visible';

        // 1. Ketik Judul
        await typeEffect(titleEl, titleText, 50);
        
        // 2. Ketik Subtitle (Link aman karena typeEffect skip tag HTML)
        await typeEffect(subtitleEl, subtitleHtml, 30);
        
        // 3. (Opsional) Munculkan container search pelan-pelan setelah teks selesai
        const containerEl = document.querySelector('.container');
        if (containerEl) {
            containerEl.style.visibility = 'visible';
            containerEl.style.opacity = '0'; 
            containerEl.style.animation = 'fadeInUp 1s ease-out forwards';
        }
    }

    if (footerEl) footerEl.classList.add('fade-in');

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

    const dynamicLinkBottom = document.getElementById('dynamic-footer-link');
    
    if (dynamicLinkBottom) {
        let isAboutState = true;
        
        setInterval(() => {
            dynamicLinkBottom.classList.add('fading-out');

            setTimeout(() => {
                if (isAboutState) {
                    dynamicLinkBottom.innerHTML = 'Created by <a href="https://desty.page/anggars" target="_blank" class="footer-link">アリツ</a>';
                } else {
                    dynamicLinkBottom.innerHTML = '<a href="/about" class="footer-link">About & Credits</a>';
                }
                isAboutState = !isAboutState;
                dynamicLinkBottom.classList.remove('fading-out');
            }, 500); 

        }, 5000);
    }
});

searchBtn.addEventListener('click', searchArtist);
artistInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') searchArtist() });