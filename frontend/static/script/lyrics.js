const form = document.getElementById('lyricsForm');
const lyricsInput = document.getElementById('lyricsInput');
const resultDiv = document.getElementById('resultOutput');
const resultsSection = document.getElementById('results-section');
const analyzeButton = document.getElementById('analyzeButton');

// ▼▼▼ TAMBAHKAN DETEKSI PERANGKAT MOBILE DI SINI ▼▼▼
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Fungsi untuk menangani submit
async function analyzeLyrics() {
    const lyrics = lyricsInput.value;

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
        const res = await fetch('/analyze-lyrics', {
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
            resultDiv.innerHTML = topEmotions.map(e => `
                <div class="emotion-bar-row">
                    <span class="emotion-label">${e.label}</span>
                    <div class="emotion-bar-bg">
                        <div class="emotion-bar" style="width:${(e.score / maxScore * 100).toFixed(1)}%"></div>
                    </div>
                    <span class="emotion-score">${e.score.toFixed(3)}</span>
                </div>
            `).join('');
        } else {
            resultDiv.innerHTML = '<p style="text-align:center;">Could not determine emotions.</p>';
        }
    } catch (err) {
        console.error("Fetch error:", err);
        resultDiv.innerHTML = '<p style="color:#ff6b6b; text-align:center;">Failed to contact the analysis server.</p>';
    }
}

// Event listener untuk form, tidak ada perubahan
form.addEventListener('submit', function(e) {
    e.preventDefault();
    analyzeLyrics();
});

// Event listener untuk keyboard, dengan tambahan pengecekan mobile
lyricsInput.addEventListener('keydown', function(event) {
    // ▼▼▼ TAMBAHKAN '&& !isMobile' DI SINI ▼▼▼
    if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
        event.preventDefault(); 
        analyzeLyrics();
    }
});