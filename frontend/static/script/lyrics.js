const form = document.getElementById('lyricsForm');
const lyricsInput = document.getElementById('lyricsInput');
const resultDiv = document.getElementById('resultOutput');
const resultsSection = document.getElementById('results-section');
const analyzeButton = document.getElementById('analyzeButton');

// ▼▼▼ TAMBAHKAN DETEKSI PERANGKAT MOBILE DI SINI ▼▼▼
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Helper: SVG Spinner HTML
const getSpinnerHtml = (text) => `
    <div class="loading-state-container">
        <svg class="spinner" viewBox="0 0 50 50">
            <circle class="path" cx="25" cy="25" r="20" fill="none"></circle>
        </svg>
        <span>${text}</span>
    </div>
`;

// Fungsi untuk menangani submit
async function analyzeLyrics() {
    const lyrics = lyricsInput.value;

    if (!lyrics || lyrics.trim() === '') {
        resultsSection.style.display = 'block';
        // Gunakan class .status-msg error yang baru dibuat
        resultDiv.innerHTML = `<p class="status-msg error">Please paste some lyrics first!</p>`;
        return; // Stop proses di sini
    }

    // (Kode 'analyzeButton.classList.add('loading');' udah DIHAPUS dari sini)

    resultsSection.style.display = 'block';
    // Ganti loading lama dengan helper SVG baru
    resultDiv.innerHTML = getSpinnerHtml("Analyzing...");
    
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
    // (Blok 'finally' juga udah DIHAPUS dari sini)
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
                        currentHtml += char;
                        index++;
                    }
                } else {
                    currentHtml += char;
                    index++;
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

// Jalankan animasi setelah halaman dimuat
document.addEventListener('DOMContentLoaded', async function() {
    const titleEl = document.querySelector('header h1');
    const subtitleEl = document.querySelector('header p.subtitle');
    const containerEl = document.querySelector('.container');
    const footerEl = document.querySelector('footer');

    if (titleEl && subtitleEl && containerEl) {
        const titleText = titleEl.textContent;
        const subtitleText = subtitleEl.textContent; // Ambil teks biasa karena sudah tidak ada link

        // 1. TAHAN DULU: Sembunyikan section & matikan animasi CSS bawaan
        // Kita cari elemen .section di dalam container
        const sectionEl = containerEl.querySelector('.section');
        if (sectionEl) {
            sectionEl.style.opacity = '0';
            sectionEl.style.animation = 'none'; 
        }

        // 2. Bersihkan Header & Siapkan untuk diketik
        titleEl.innerHTML = '';
        subtitleEl.innerHTML = '';
        titleEl.style.visibility = 'visible';
        subtitleEl.style.visibility = 'visible';
        
        // Pastikan container terlihat (tapi isinya .section masih hidden opacity 0)
        containerEl.style.visibility = 'visible';

        // 3. Animasi Ketik Judul
        await typeEffect(titleEl, titleText, 50);
        
        // 4. Animasi Ketik Subtitle (Typing Effect)
        await typeEffect(subtitleEl, subtitleText, 30);

        // 5. BARU MUNCULKAN BODY (Input Form)
        if (sectionEl) {
            sectionEl.style.animation = 'fadeInUp 1s ease-out forwards';
        }
    }

    // 6. Footer muncul terakhir
    if (footerEl) footerEl.classList.add('fade-in');

    // ▼▼▼ TAMBAHAN: LOGIC DYNAMIC FOOTER (About <-> Aritsu) ▼▼▼
    const dynamicLinkBottom = document.getElementById('dynamic-footer-link');
    
    if (dynamicLinkBottom) {
        let isAboutState = true; // Mulai dari About

        setInterval(() => {
            // 1. Fade Out
            dynamicLinkBottom.classList.add('fading-out');

            // 2. Tunggu 500ms, lalu ganti konten
            setTimeout(() => {
                if (isAboutState) {
                    // Ganti ke: Created by Aritsu
                    // "Created by" teks biasa, "アリツ" link (hover kuning/hijau)
                    dynamicLinkBottom.innerHTML = 'Created by <a href="https://desty.page/anggars" target="_blank" class="footer-link">アリツ</a>';
                } else {
                    // Balik ke: About & Credits
                    dynamicLinkBottom.innerHTML = '<a href="/about" class="footer-link">About & Credits</a>';
                }
                
                isAboutState = !isAboutState;

                // 3. Fade In
                dynamicLinkBottom.classList.remove('fading-out');
            }, 500); 

        }, 5000); // Ganti setiap 5 detik
    }   
});