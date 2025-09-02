// Pengecekan yang andal untuk lingkungan lokal vs. online (Vercel)
const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// Jika lokal, gunakan alamat lengkap. Jika di Vercel, biarkan kosong agar proxy Vercel bekerja.
const API_BASE_URL = isLocal ? 'http://localhost:8000' : '';
const modeFilter = document.getElementById('mode-filter');
const geniusArea = document.getElementById('geniusArea');
const lyricsForm = document.getElementById('lyricsForm');
const artistQueryInput = document.getElementById('artistQuery');
const searchArtistBtn = document.getElementById('searchArtistBtn');
const artistResultsDiv = document.getElementById('artistResults');
const songResultsDiv = document.getElementById('songResults');
const geniusLyricsResultDiv = document.getElementById('geniusLyricsResult');
const form = document.getElementById('lyricsForm');
const lyricsInput = document.getElementById('lyricsInput');
const resultDiv = document.getElementById('resultOutput');
const resultsSection = document.getElementById('results-section');
const analyzeButton = document.getElementById('analyzeButton');

// Deteksi perangkat mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Fungsi untuk menangani submit manual lyrics
async function analyzeLyrics(customLyrics = null) {
    const lyrics = customLyrics || lyricsInput.value;

    if (!lyrics || lyrics.trim() === '') {
        resultsSection.style.display = 'block';
        resultDiv.innerHTML = `<p style="color:#ff6b6b; text-align:center;">Please paste some lyrics first.</p>`;
        return;
    }

    resultsSection.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <p style="text-align: center;">Analyzing...</p>
    `;
    
    try {
        const res = await fetch(`${API_BASE_URL}/analyze-lyrics`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({lyrics: lyrics})
        });

        if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
        const data = await res.json();

        if (data.error) {
            resultDiv.innerHTML = `<p style="color:#ff6b6b; text-align:center;">${data.error}</p>`;
        } else if (data.emotions && data.emotions.length > 0) {
            const topEmotions = data.emotions.filter(e => e.score > 0.05).slice(0, 10);

            if (topEmotions.length === 0) {
                resultDiv.innerHTML = '<p style="text-align:center;">Could not find significant emotions.</p>';
                return;
            }
            
            const maxScore = Math.max(...topEmotions.map(e => e.score));
            resultDiv.innerHTML = `
                <div class="emotion-bars-group">
                    ${topEmotions.map(e => `
                        <div class="emotion-bar-row">
                            <span class="emotion-label">${e.label}</span>
                            <div class="emotion-bar-container">
                                <div class="emotion-bar-bg">
                                    <div class="emotion-bar" style="width:${(e.score / maxScore * 100).toFixed(1)}%"></div>
                                </div>
                                <span class="emotion-score">${e.score.toFixed(3)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            resultDiv.innerHTML = '<p style="text-align:center;">Could not determine emotions.</p>';
        }
    } catch (err) {
        console.error("Fetch error:", err);
        resultDiv.innerHTML = '<p style="color:#ff6b6b; text-align:center;">Failed to contact the analysis server.</p>';
    }
}

// Event listener untuk form submit
form.addEventListener('submit', function(e) {
    e.preventDefault();
    analyzeLyrics();
});

// Event listener untuk keyboard
lyricsInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
        event.preventDefault(); 
        analyzeLyrics();
    }
});

// --- LOGIKA PERGANTIAN MODE (DROPDOWN) ---
modeFilter.addEventListener('change', (event) => {
    const selectedMode = event.target.value;
    lyricsForm.style.display = (selectedMode === 'manual') ? 'flex' : 'none';
    geniusArea.style.display = (selectedMode === 'genius') ? 'flex' : 'none';
    resultsSection.style.display = 'none'; // Sembunyikan hasil saat ganti mode
    
    // Reset semua area ketika ganti mode
    artistResultsDiv.innerHTML = '';
    songResultsDiv.innerHTML = '';
    geniusLyricsResultDiv.innerHTML = '';
    artistQueryInput.value = '';
});

// Set mode default saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    lyricsForm.style.display = 'flex';
    geniusArea.style.display = 'none';
});

// --- LOGIKA PENCARIAN GENIUS ---
async function searchArtist() {
    const query = artistQueryInput.value.trim();
    if (!query) {
        alert('Please enter an artist name');
        return;
    }

    artistResultsDiv.innerHTML = `<div class="loading-spinner"></div>`;
    songResultsDiv.innerHTML = '';
    geniusLyricsResultDiv.innerHTML = '';
    resultsSection.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE_URL}/genius/search_artist?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        
        const artists = await res.json();

        if (!artists || artists.length === 0) {
            artistResultsDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">Artist not found. Try a different name.</p>`;
            return;
        }
        
        artistResultsDiv.innerHTML = `
            <h3>Select Artist:</h3>
            <div class="genius-list">
                ${artists.map(artist => 
                    `<button type="button" class="artist-btn" data-artist-id="${artist.id}">${artist.name}</button>`
                ).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Search error:', error);
        artistResultsDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">Search failed. Please try again.</p>`;
    }
}

async function getArtistSongs(artistId) {
    songResultsDiv.innerHTML = `<div class="loading-spinner"></div>`;
    geniusLyricsResultDiv.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE_URL}/genius/artist_songs?artist_id=${artistId}`);
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Songs API Error:', res.status, errorText);
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        
        const songs = await res.json();
        console.log(`Received ${songs.length} songs for artist ${artistId}`);

        if (!songs || songs.length === 0) {
            songResultsDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">No songs found for this artist.</p>`;
            return;
        }
        
        // Show all songs, don't limit to 20
        songResultsDiv.innerHTML = `
            <h3>Select Song (${songs.length} found):</h3>
            <div class="genius-list">
                ${songs.map(song => 
                    `<button type="button" class="song-btn" data-song-id="${song.id}" title="${song.title}">${song.title}</button>`
                ).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Songs fetch error:', error);
        songResultsDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">Failed to load songs: ${error.message}</p>`;
    }
}

// REPLACE ONLY this getSongLyrics function in your existing lyrics.js:

async function getSongLyrics(songId) {
    geniusLyricsResultDiv.innerHTML = `
        <h3>Lyrics:</h3>
        <div class="loading-spinner"></div>
        <p style="text-align: center;">Fetching lyrics... This may take a moment.</p>
    `;

    try {
        const res = await fetch(`${API_BASE_URL}/genius/song_lyrics?song_id=${songId}`);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('Lyrics response:', data);

        if (!data || !data.lyrics) {
            geniusLyricsResultDiv.innerHTML = `
                <h3>Lyrics:</h3>
                <p style="text-align:center; color:#ff6b6b;">Could not retrieve lyrics for this song.</p>
                <p style="text-align:center; color:#888; font-size:0.9rem;">Please try a different song or paste lyrics manually.</p>
            `;
            return;
        }

        // Check if manual input is needed (fallback scenario)
        if (data.manual_needed) {
            geniusLyricsResultDiv.innerHTML = `
                <h3>Lyrics Not Found Automatically</h3>
                <div style="background: #2a2a2a; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <p style="color: #ffa500; margin-bottom: 0.5rem;"><strong>⚠️ Auto-fetch failed</strong></p>
                    <p style="color: #ccc; font-size: 0.9rem;">${data.lyrics}</p>
                    ${data.url ? `<p style="margin-top: 0.5rem;"><a href="${data.url}" target="_blank" style="color: #1DB954;">Open song page →</a></p>` : ''}
                </div>
                <h3>Paste Lyrics Manually:</h3>
                <textarea id="geniusLyricsTextarea" class="lyrics-display" placeholder="Paste the lyrics here and click analyze...">${data.song_title ? `[${data.song_title}${data.artist ? ` - ${data.artist}` : ''}]\n\n` : ''}</textarea>
                <button type="button" id="analyzeGeniusBtn" class="button-primary">Analyze These Lyrics</button>
            `;
        } else {
            // Success case - lyrics found
            geniusLyricsResultDiv.innerHTML = `
                <h3>Lyrics Found! (Editable):</h3>
                <div style="background: #1a4a2e; padding: 0.5rem 1rem; border-radius: 4px; margin-bottom: 1rem;">
                    <p style="color: #4ade80; font-size: 0.9rem; margin: 0;">✅ Lyrics retrieved successfully</p>
                </div>
                <textarea id="geniusLyricsTextarea" class="lyrics-display">${data.lyrics}</textarea>
                <button type="button" id="analyzeGeniusBtn" class="button-primary">Analyze These Lyrics</button>
            `;
        }
        
        // Scroll to lyrics section
        setTimeout(() => {
            geniusLyricsResultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
    } catch (error) {
        console.error('Lyrics fetch error:', error);
        geniusLyricsResultDiv.innerHTML = `
            <h3>Error:</h3>
            <div style="background: #4a1a1a; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <p style="color: #ff6b6b; margin-bottom: 0.5rem;"><strong>❌ Connection Error</strong></p>
                <p style="color: #ccc; font-size: 0.9rem;">Failed to load lyrics: ${error.message}</p>
                <p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">Try refreshing the page or use manual input instead.</p>
            </div>
            <h3>Manual Input:</h3>
            <textarea id="geniusLyricsTextarea" class="lyrics-display" placeholder="Paste lyrics manually here..."></textarea>
            <button type="button" id="analyzeGeniusBtn" class="button-primary">Analyze These Lyrics</button>
        `;
    }
}

// --- EVENT LISTENERS UNTUK ALUR GENIUS ---
searchArtistBtn.addEventListener('click', searchArtist);

artistQueryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchArtist();
    }
});

// Event delegation untuk button clicks
document.addEventListener('click', function(e) {
    // Handle klik artist
    if (e.target.matches('.artist-btn')) {
        const artistId = e.target.dataset.artistId;
        getArtistSongs(artistId);

        // Hapus class active dari semua artist button
        document.querySelectorAll('.artist-btn').forEach(btn => btn.classList.remove('active'));

        // Tambah class active ke button yang diklik
        e.target.classList.add('active');
    }
    
    // Handle klik song
    if (e.target.matches('.song-btn')) {
        const songId = e.target.dataset.songId;
        getSongLyrics(songId);

        // Hapus class active dari semua song button
        document.querySelectorAll('.song-btn').forEach(btn => btn.classList.remove('active'));

        // Tambah class active ke button yang diklik
        e.target.classList.add('active');
    }
    
    if (e.target.matches('#analyzeGeniusBtn')) {
        const lyricsTextarea = document.querySelector('.lyrics-display'); // Ini sekarang adalah textarea
        if (lyricsTextarea) {
            const lyricsText = lyricsTextarea.value; // <-- UBAH KE .value
            analyzeLyrics(lyricsText);
        }
    }
});

// ▼▼▼ TAMBAHKAN BLOK KODE INI DI AKHIR FILE ▼▼▼

// Event listener untuk keyboard di area lirik Genius (hanya desktop)
document.addEventListener('keydown', function(event) {
    // Cek apakah event terjadi di dalam textarea lirik Genius
    if (event.target.matches('#geniusLyricsTextarea')) {
        // Gunakan logika yang sama persis dengan input manual
        if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
            event.preventDefault(); // Mencegah baris baru
            
            // Cari tombol "Analyze These Lyrics" dan simulasikan klik
            const analyzeGeniusBtn = document.getElementById('analyzeGeniusBtn');
            if (analyzeGeniusBtn) {
                analyzeGeniusBtn.click();
            }
        }
    }
});