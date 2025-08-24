document.addEventListener('DOMContentLoaded', function() {
    // --- SEMUA DEKLARASI ELEMEN DI SATU TEMPAT ---
    const modeFilter = document.getElementById('mode-filter');
    const lyricsForm = document.getElementById('lyricsForm');
    const geniusArea = document.getElementById('geniusArea');
    
    const lyricsInput = document.getElementById('lyricsInput');
    const resultsSection = document.getElementById('results-section');
    const resultDiv = document.getElementById('resultOutput');

    const artistQueryInput = document.getElementById('artistQuery');
    const searchArtistBtn = document.getElementById('searchArtistBtn');
    const artistResultsDiv = document.getElementById('artistResults');
    const songResultsDiv = document.getElementById('songResults');
    const geniusLyricsResultDiv = document.getElementById('geniusLyricsResult');

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // --- FUNGSI-FUNGSI UTAMA ---

    async function analyzeLyrics(customLyrics = null) {
        const lyrics = customLyrics || lyricsInput.value;

        if (!lyrics || lyrics.trim() === '') {
            resultsSection.style.display = 'block';
            resultDiv.innerHTML = `<p style="color:#ff6b6b; text-align:center;">Please paste some lyrics first.</p>`;
            return;
        }

        resultsSection.style.display = 'block';
        resultDiv.innerHTML = `
            <h2>Analyzing Emotions...</h2>
            <div class="loading-spinner"></div>
        `;
        
        try {
            const res = await fetch('/api/analyze-lyrics', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({lyrics: lyrics})
            });

            if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
            const data = await res.json();

            if (data.error) {
                resultDiv.innerHTML = `<p style="color:#ff6b6b; text-align:center;">${data.error}</p>`;
            } else if (data.emotions && data.emotions.length > 0) {
                resultDiv.innerHTML = `
                    <h2>Analysis Result</h2>
                    <div class="emotion-bars-group">
                        ${data.emotions.slice(0, 10).map(e => `
                            <div class="emotion-bar-row">
                                <span class="emotion-label">${e.label}</span>
                                <div class="emotion-bar-bg">
                                    <div class="emotion-bar" style="width:${(e.score * 100).toFixed(1)}%"></div>
                                </div>
                                <span class="emotion-score">${e.score.toFixed(3)}</span>
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

    async function searchArtist() {
        const query = artistQueryInput.value.trim();
        if (!query) return;

        artistResultsDiv.innerHTML = `<h3>Searching...</h3><div class="loading-spinner"></div>`;
        songResultsDiv.innerHTML = '';
        geniusLyricsResultDiv.innerHTML = '';
        resultsSection.style.display = 'none';

        try {
            const res = await fetch(`/api/search-artist?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('Search failed');
            
            const artists = await res.json();

            if (artists.error || !artists || artists.length === 0) {
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
        songResultsDiv.innerHTML = `<h3>Loading songs...</h3><div class="loading-spinner"></div>`;
        geniusLyricsResultDiv.innerHTML = '';

        try {
            const res = await fetch(`/api/artist-songs?artist_id=${artistId}`);
            if (!res.ok) throw new Error('Failed to fetch songs');
            
            const songs = await res.json();

            if (songs.error || !songs || songs.length === 0) {
                songResultsDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">No songs found for this artist.</p>`;
                return;
            }
            
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
            songResultsDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">Failed to load songs.</p>`;
        }
    }

    async function getSongLyrics(songId) {
        geniusLyricsResultDiv.innerHTML = `<h3>Fetching lyrics...</h3><div class="loading-spinner"></div>`;

        try {
            const res = await fetch(`/api/song-lyrics?song_id=${songId}`);
            if (!res.ok) throw new Error('Failed to fetch lyrics');
            
            const data = await res.json();

            if (data.error || !data.lyrics) {
                // Tampilkan pesan error yang lebih informatif dari server jika ada
                const errorMessage = data.error || "Could not retrieve lyrics for this song.";
                geniusLyricsResultDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">${errorMessage}</p>`;
                return;
            }

            geniusLyricsResultDiv.innerHTML = `
                <h3>Lyrics (Editable):</h3>
                <textarea id="geniusLyricsTextarea" class="lyrics-display">${data.lyrics}</textarea>
                <button type="button" id="analyzeGeniusBtn" class="button-primary">Analyze These Lyrics</button>
            `;
        } catch (error) {
            console.error('Lyrics fetch error:', error);
            geniusLyricsResultDiv.innerHTML = `<p style="text-align:center; color:#ff6b6b;">Failed to load lyrics. Please try again.</p>`;
        }
    }

    // --- EVENT LISTENERS ---

    modeFilter.addEventListener('change', (event) => {
        const selectedMode = event.target.value;
        lyricsForm.style.display = (selectedMode === 'manual') ? 'flex' : 'none';
        geniusArea.style.display = (selectedMode === 'genius') ? 'flex' : 'none';
        resultsSection.style.display = 'none';
        artistResultsDiv.innerHTML = '';
        songResultsDiv.innerHTML = '';
        geniusLyricsResultDiv.innerHTML = '';
        artistQueryInput.value = '';
    });

    lyricsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        analyzeLyrics();
    });

    lyricsInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
            event.preventDefault(); 
            lyricsForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    });

    searchArtistBtn.addEventListener('click', searchArtist);

    artistQueryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchArtist();
        }
    });

    document.addEventListener('click', function(e) {
        if (e.target.matches('.artist-btn')) {
            document.querySelectorAll('.artist-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            getArtistSongs(e.target.dataset.artistId);
        }
        
        if (e.target.matches('.song-btn')) {
            document.querySelectorAll('.song-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            getSongLyrics(e.target.dataset.songId);
        }
        
        if (e.target.matches('#analyzeGeniusBtn')) {
            const lyricsTextarea = document.getElementById('geniusLyricsTextarea');
            if (lyricsTextarea) {
                analyzeLyrics(lyricsTextarea.value);
            }
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.target.matches('#geniusLyricsTextarea')) {
            if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
                event.preventDefault();
                const analyzeGeniusBtn = document.getElementById('analyzeGeniusBtn');
                if (analyzeGeniusBtn) {
                    analyzeGeniusBtn.click();
                }
            }
        }
    });

    // --- INISIALISASI HALAMAN ---
    lyricsForm.style.display = 'flex';
    geniusArea.style.display = 'none';
});