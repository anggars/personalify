let genreChartInstance = null;
let currentlyPlayingTrackId = null;
let currentEmbedContainer = null;
let currentlyActiveListItem = null;

const categoryFilterSelect = document.getElementById("category-filter");
const categoryFilterWrapper = document.getElementById("category-filter-wrapper");
const sections = {
    artists: document.getElementById("artists-section"),
    tracks: document.getElementById("tracks-section"),
    genres: document.getElementById("genres-section")
};
const modal = document.getElementById("save-modal-overlay");
const fontConfig = {
    // Menggunakan Variable Font agar satu file mencakup semua ketebalan (200-800)
    // Ini lebih hemat dan cepat daripada fetch banyak file static.
    woff2Url: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans@5.0.19/files/plus-jakarta-sans-latin-wght-normal.woff2'
};

let cachedFontCSS = null;

async function prepareFont() {
    if (cachedFontCSS) return cachedFontCSS;
    
    try {
        console.log("Fetching font for screenshot...");
        const response = await fetch(fontConfig.woff2Url);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const blob = await response.blob();
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result;
                cachedFontCSS = `
                    @font-face {
                        font-family: 'Plus Jakarta Sans';
                        font-style: normal;
                        font-weight: 200 800;
                        font-display: swap;
                        src: url(${base64data}) format('woff2');
                        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
                    }
                `;
                console.log("Font prepared successfully.");
                resolve(cachedFontCSS);
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Font fetch failed, falling back to system fonts:", e);
        return ""; 
    }
}
prepareFont();

/**
 * FUNGSI BARU: Efek Ketik (Typing Effect)
 * Menampilkan teks satu per satu, dan bisa menangani tag HTML (seperti <b>)
 * * @param {HTMLElement} element - Elemen HTML (misal: <p>) untuk diisi teks.
 * @param {string} text - Teks lengkap yang ingin ditampilkan (termasuk HTML).
 * @param {number} speed - Kecepatan mengetik dalam milidetik (opsional).
 */

function updateGlow(e, el) {
    // Tentukan sumber koordinat: (e.touches[0] untuk touch, e untuk mouse)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Safety check jika koordinat tidak ditemukan (misal: multi-touch)
    if (clientX === undefined) return; 

    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * 100;
    // Gunakan el.clientHeight untuk Y agar perhitungan posisi vertikal lebih stabil
    const y = (clientY - rect.top) / el.clientHeight * 100; 
    
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
};

function typeEffect(element, text, speed = 30) {
    // 1. Fungsi ini sekarang mengembalikan Promise
    return new Promise((resolve) => {
        let index = 0;
        let currentHtml = '';
        
        // Hapus kursor lama jika ada
        const oldCursor = element.querySelector('.typing-cursor');
        if (oldCursor) {
            oldCursor.remove();
        }
        
        // Bersihkan teks sebelumnya
        element.innerHTML = '';

        function typeWriter() {
            if (index < text.length) {
                let char = text.charAt(index);

                if (char === '<') {
                    // Jika ini adalah tag HTML, temukan akhirnya
                    let tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        // Ambil seluruh tag dan tambahkan sekaligus
                        let tag = text.substring(index, tagEnd + 1);
                        currentHtml += tag;
                        index = tagEnd + 1; // Lompat ke setelah tag
                    } else {
                        // Tag tidak lengkap, anggap sebagai teks biasa
                        currentHtml += char;
                        index++;
                    }
                } else {
                    // Teks biasa, tambahkan per karakter
                    currentHtml += char;
                    index++;
                }

                // Tampilkan HTML saat ini + kursor
                element.innerHTML = currentHtml + '<span class="typing-cursor"></span>';
                
                // Lanjutkan ke karakter berikutnya
                setTimeout(typeWriter, speed);
            } else {
                // Selesai mengetik, hapus kursor
                element.innerHTML = currentHtml;
                // 2. Beri tahu Promise-nya bahwa kita sudah selesai
                resolve();
            }
        }

        // Mulai efek ketik
        typeWriter();
    });
}

function updateGenreChart(newLabels, newCounts) {
    if (!genreChartInstance) return;

    const fullColorList = [
        '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
        '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
        '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
    ];

    genreChartInstance.data.labels = newLabels;
    genreChartInstance.data.datasets[0].data = newCounts;
    genreChartInstance.data.datasets[0].backgroundColor = fullColorList;

    genreChartInstance.update();
}

function updateCategoryDisplay() {
    const value = categoryFilterSelect.value;
    
    // (PERBAIKAN) Reset class 'no-animation' di genres DULU
    const genreItems = sections.genres.querySelectorAll('li.no-animation');
    genreItems.forEach(item => {
        item.classList.remove('no-animation');
    });

    // Sembunyikan semua section
    for (const key in sections) {
        sections[key].classList.remove("active");
    }

    // Tampilkan section yang dipilih
    if (sections[value]) {
        sections[value].classList.add("active");
    }
}

categoryFilterSelect.addEventListener("change", updateCategoryDisplay);

function checkScreenSize() {
    if (window.innerWidth <= 768) {
        categoryFilterWrapper.style.display = "inline-block";
        updateCategoryDisplay();
    } else {
        for (const key in sections) {
            sections[key].style.display = "block";
            sections[key].classList.add("active");
        }
        categoryFilterWrapper.style.display = "none";
    }
}

window.addEventListener("resize", checkScreenSize);

document.addEventListener("DOMContentLoaded", checkScreenSize);

document.getElementById("time-filter").addEventListener("change", function() {
    const selected = this.value;
    const currentURL = window.location.href.split('?')[0].split('#')[0];
    const userId = currentURL.split('/').pop();
    window.location.href = `/dashboard/${userId}?time_range=${selected}`;
});

function toggleMore(index, el) {
    const more = document.getElementById("more-" + index);
    const isVisible = more.style.display === "inline";
    more.style.display = isVisible ? "none" : "inline";
    el.textContent = isVisible ? "+ more" : "− less";
}

// =================== NEW SPOTIFY INTEGRATION FUNCTIONS ===================

function openArtistProfile(artistId) {
    const spotifyUrl = `https://open.spotify.com/artist/${artistId}`;
    window.open(spotifyUrl, '_blank');
}


function toggleTrackEmbed(trackId, clickedDiv) {
    const isAlreadyActive = clickedDiv.classList.contains('embed-shown');

    if (currentlyActiveListItem && currentlyActiveListItem !== clickedDiv) {
        currentlyActiveListItem.classList.remove('embed-shown');
        const oldPlaceholder = currentlyActiveListItem.querySelector('.embed-placeholder');
        if (oldPlaceholder) {
            oldPlaceholder.innerHTML = '';
        }
    }

    if (isAlreadyActive) {
        clickedDiv.classList.remove('embed-shown');
        const placeholder = clickedDiv.querySelector('.embed-placeholder');
        if (placeholder) {
            placeholder.innerHTML = '';
        }
        currentlyActiveListItem = null;
    } else {
        const placeholder = clickedDiv.querySelector('.embed-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `
                <iframe
                    src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0"
                    width="100%"
                    height="80"
                    frameborder="0"
                    allowfullscreen=""
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy">
                </iframe>
            `;
        }
        clickedDiv.classList.add('embed-shown');
        currentlyActiveListItem = clickedDiv;
    }
}

function closeParentEmbed(event, rankElement) {
    const listItem = rankElement.closest('.list-item.track-item');

    // Hanya jalankan fungsi jika embed sedang terbuka
    if (listItem && listItem.classList.contains('embed-shown')) {
        // Ini SANGAT PENTING untuk mencegah embed terbuka lagi
        event.stopPropagation();

        // Logika untuk menutup embed
        listItem.classList.remove('embed-shown');
        const placeholder = listItem.querySelector('.embed-placeholder');
        if (placeholder) {
            placeholder.innerHTML = '';
        }
        if (currentlyActiveListItem === listItem) {
            currentlyActiveListItem = null;
        }
    }
}

// Fungsi ini untuk memastikan fitur "Save as Image" tetap bekerja
function closeCurrentEmbed() {
    if (currentlyActiveListItem) {
        currentlyActiveListItem.classList.remove('embed-shown');
        const placeholder = currentlyActiveListItem.querySelector('.embed-placeholder');
        if (placeholder) {
            placeholder.innerHTML = '';
        }
        currentlyActiveListItem = null;
    }
}

// Fungsi lama 'restoreTrackList' sudah tidak diperlukan lagi,
// karena logikanya sudah terintegrasi di dalam 'toggleTrackEmbed' yang baru.
// Anda bisa menghapusnya jika ada.

function showSaveOptions() {
    modal.style.display = 'flex';
}

function hideSaveOptions() {
    modal.style.display = 'none';
}

function customTooltip(tooltipModel) {
    let tooltipEl = document.getElementById('chartjs-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.innerHTML = '<table></table>';
        document.body.appendChild(tooltipEl);
    }

    if (tooltipModel.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    if (tooltipModel.body || (tooltipModel.title && tooltipModel.title.length > 0) || (tooltipModel.footer && tooltipModel.footer.length > 0)) {
        const titleLines = tooltipModel.title || [];
        const footerLines = tooltipModel.footer || [];
        let innerHtml = '<thead>';

        titleLines.forEach(function(title) {
            innerHtml += '<tr><th>' + title + '</th></tr>';
        });

        innerHtml += '</thead><tbody>';

        footerLines.forEach(function(footer) {
             innerHtml += '<tr><td>' + footer + '</td></tr>';
        });

        innerHtml += '</tbody>';
        let tableRoot = tooltipEl.querySelector('table');
        tableRoot.innerHTML = innerHtml;
    }

    const position = tooltipModel._chart.canvas.getBoundingClientRect();

    tooltipEl.style.opacity = 1;
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
    tooltipEl.style.fontFamily = tooltipModel._bodyFontFamily;
    tooltipEl.style.fontSize = tooltipModel.bodyFontSize + 'px';
    tooltipEl.style.fontStyle = tooltipModel._bodyFontStyle;
    tooltipEl.style.padding = tooltipModel.yPadding + 'px ' + tooltipModel.xPadding + 'px';
    tooltipEl.style.pointerEvents = 'none';
}

document.addEventListener('keydown', function(event) {
    // Ambil elemen modal
    const modal = document.getElementById("save-modal-overlay");
    
    // Cek: 1. Apakah tombol yang ditekan adalah 'Escape'? DAN 2. Apakah modal sedang tampil ('display: flex')?
    if (event.key === 'Escape' && modal.style.display === 'flex') {
        // Jika ya, panggil fungsi untuk menutup modal
        hideSaveOptions();
    }
});

async function generateImage(selectedCategory) {
    hideSaveOptions();
    closeCurrentEmbed();
    
    // --- 1. PASANG TIRAI (OVERLAY) BIAR USER GAK LIAT "DAPUR" ---
    // Ini solusi biar tampilan "dobel" atau berantakan gak kelihatan
    const loadingOverlay = document.createElement('div');
    Object.assign(loadingOverlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#121212', // Warna background tema lu
        zIndex: '9999999', // Paling depan
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#1DB954', // Hijau Spotify
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 'bold'
    });
    loadingOverlay.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 1.2rem;">Generating your image...</div>
        <div class="loading-dots" style="font-size: 1.5rem;">🡻</div>
    `;
    document.body.appendChild(loadingOverlay);

    // --- 2. LOGIKA LAYOUT (TETAP PAKE FORCE DESKTOP SESUAI REQUEST) ---
    // Karena udah ketutup tirai, bebas mau nambah class apa aja
    document.body.classList.add('force-desktop-view');
    document.body.classList.add('download-mode');

    // Sembunyikan section lain (Logika lama lu)
    for (const key in sections) { 
        // Simpan display asli biar bisa direstore nanti (opsional, tapi aman)
        sections[key].dataset.originalDisplay = sections[key].style.display;
        sections[key].style.display = "none"; 
    }
    const sectionToCapture = sections[selectedCategory];
    sectionToCapture.style.display = "block";

    // Clone Section
    const clone = sectionToCapture.cloneNode(true);
    
    // Bersihin Clone (Limit 10 & Hapus Show More)
    const allCloneItems = clone.querySelectorAll('ol.list-container > li');
    allCloneItems.forEach((item, index) => {
        if (index >= 10) item.style.display = 'none';
    });
    const showMoreClone = clone.querySelector('.show-more-container');
    if (showMoreClone) showMoreClone.style.display = 'none';

    // --- FIX GENRE CHART (CANVAS -> IMAGE) ---
    if (selectedCategory === 'genres') {
        const originalCanvas = document.getElementById('genreChart');
        const clonedCanvas = clone.querySelector('#genreChart');
        if (originalCanvas && clonedCanvas) {
            const chartImage = new Image();
            chartImage.src = originalCanvas.toDataURL('image/png');
            chartImage.style.display = 'block';
            chartImage.style.width = `${originalCanvas.offsetWidth}px`;
            chartImage.style.height = `${originalCanvas.offsetHeight}px`;
            
            const computedStyle = window.getComputedStyle(originalCanvas);
            chartImage.style.marginTop = computedStyle.marginTop;
            chartImage.style.marginBottom = computedStyle.marginBottom;
            chartImage.style.marginLeft = 'auto';
            chartImage.style.marginRight = 'auto';
            clonedCanvas.parentNode.replaceChild(chartImage, clonedCanvas);
        }
    }

    // --- 3. CONTAINER SETUP (Off-Screen tapi Rendered) ---
    const STORY_WIDTH = 720;
    const STORY_HEIGHT = 1280;

    const container = document.createElement("div");
    container.style.width = `${STORY_WIDTH}px`;
    container.style.height = `${STORY_HEIGHT}px`;
    container.style.background = "#121212";
    container.style.color = "#fff";
    container.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    container.style.overflow = 'hidden';
    
    // Tetap fixed, tapi di belakang layar (z-index minus)
    // Walaupun ada overlay, ini tetap perlu biar html-to-image gak bingung
    container.style.position = 'fixed'; 
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-9999';

    // --- 4. ABSOLUTE CENTER WRAPPER (Sesuai Request) ---
    const contentWrapper = document.createElement("div");
    contentWrapper.style.width = '100%';
    contentWrapper.style.padding = "80px 40px 40px 40px";
    contentWrapper.style.boxSizing = "border-box";
    
    // Center Absolute
    contentWrapper.style.position = 'absolute';
    contentWrapper.style.top = '50%';
    contentWrapper.style.left = '50%';
    contentWrapper.style.transform = 'translate(-50%, -50%)';
    
    // Header
    const pageHeader = document.querySelector('header');
    const headerClone = pageHeader.cloneNode(true);
    headerClone.style.textAlign = 'center';
    headerClone.style.marginBottom = '1.5rem';
    headerClone.querySelectorAll('.typing-cursor').forEach(c => c.remove());
    
    contentWrapper.appendChild(headerClone);
    contentWrapper.appendChild(clone);

    // --- 5. STYLE FIX (TERMASUK PILLS FIX YG SUDAH BENAR) ---
    const styleFix = document.createElement('style');
    styleFix.innerHTML = `
        .list-container li { opacity: 1 !important; animation: none !important; }
        
        .genre-pills .genre-label {
            display: inline-flex !important; 
            align-items: center !important;
            justify-content: center !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important; 
            background: #2a2a2a !important; 
            border-radius: 10px !important;
            border: 1px solid var(--genre-color, #555);
            color: #FFFFFF !important;
            font-size: 0.6rem !important;
            white-space: nowrap !important;
            height: 18px !important; 
            box-sizing: border-box !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
            padding-top: 0 !important;
            padding-bottom: 2px !important; /* Fix Teks Naik */
            line-height: normal !important;
            margin-top: 0 !important;
        }
    `;
    contentWrapper.appendChild(styleFix);

    // Footer
    const footer = document.createElement("div");
    footer.innerHTML = `Personalify © 2025 • Powered by Spotify API`;
    footer.style.paddingTop = "2rem";
    footer.style.textAlign = "center";
    footer.style.fontSize = "0.75rem";
    footer.style.color = "#888";
    footer.style.marginTop = "auto";
    contentWrapper.appendChild(footer);

    container.appendChild(contentWrapper);

    // Fungsi Render
    async function renderCanvas() {
        document.body.appendChild(container);

        // Zoom Logic
        const contentHeight = contentWrapper.scrollHeight;
        if (contentHeight > STORY_HEIGHT) {
            const scale = STORY_HEIGHT / contentHeight;
            contentWrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
        } else {
            contentWrapper.style.transform = `translate(-50%, -50%)`;
        }

        try {
            const fontCSS = await prepareFont();
            await document.fonts.ready;
            // Delay dikit biar layout settle di balik layar
            await new Promise(r => setTimeout(r, 500)); 

            const dataUrl = await htmlToImage.toPng(container, {
                quality: 1.0,
                pixelRatio: 2,
                cacheBust: true,
                fontEmbedCSS: fontCSS,
                backgroundColor: '#121212',
                width: STORY_WIDTH,
                height: STORY_HEIGHT,
                style: {
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    visibility: 'visible'
                },
                filter: (node) => (node.tagName !== 'BUTTON')
            });

            const link = document.createElement("a");
            link.download = `personalify-${selectedCategory}-${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();

        } catch (err) {
            console.error("Gagal generate image:", err);
            alert("Gagal membuat gambar. Coba refresh halaman.");
        } finally {
            cleanup();
        }
    }

    function cleanup() {
        // Hapus Container Screenshot
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
        
        // Restore Layout Asli
        document.body.classList.remove('force-desktop-view');
        document.body.classList.remove('download-mode');
        
        // Restore Section Display
        // Ini biar pas tirai dibuka, tampilan balik normal (gak blank/salah section)
        checkScreenSize(); // Ini function bawaan lu buat reset display based on screen size

        // PENTING: Cabut Tirai (Overlay)
        if (document.body.contains(loadingOverlay)) {
            // Kasih delay dikit biar transisi smooth
            setTimeout(() => {
                document.body.removeChild(loadingOverlay);
            }, 500);
        }
    }

    // Preload Images Logic
    const imgs = container.querySelectorAll('img');
    if (imgs.length === 0) {
        renderCanvas();
    } else {
        let loadedCount = 0;
        const totalImgs = imgs.length;
        const timeout = setTimeout(() => {
            if (loadedCount < totalImgs) renderCanvas();
        }, 4000);

        imgs.forEach(img => {
            const originalSrc = img.src;
            img.removeAttribute('src'); 
            img.crossOrigin = "anonymous";
            
            const onJsLoad = () => {
                loadedCount++;
                if (loadedCount === totalImgs) {
                    clearTimeout(timeout);
                    renderCanvas();
                }
            };
            img.onload = onJsLoad;
            img.onerror = onJsLoad;
            img.src = originalSrc;
            if (img.complete && img.naturalHeight !== 0) {
                img.onload();
            }
        });
    }
}

document.getElementById('save-artists-btn').addEventListener('click', () => generateImage('artists'));
document.getElementById('save-tracks-btn').addEventListener('click', () => generateImage('tracks'));
document.getElementById('save-genres-btn').addEventListener('click', () => generateImage('genres'));

// Function untuk load analisis emosi di background
async function loadEmotionAnalysis(isExtended = false) {
    const emotionElement = document.querySelector('.emotion-recap');
    const currentText = emotionElement.textContent;

    // Cek apakah masih menggunakan teks placeholder ATAU jika diminta extended analysis
    if (currentText.includes("being analyzed") || currentText.includes("getting ready") || isExtended) {
        // Tambahkan loading indicator hanya jika bukan extended
        if (!isExtended) {
            emotionElement.innerHTML = 'Your music vibe is being analyzed... <span class="loading-dots">⚡</span>';
        } else {
            emotionElement.innerHTML = 'Analyzing extended music collection... <span class="loading-dots">⚡</span>';
        }

        try {
            // Ambil spotify_id dari URL
            const urlParts = window.location.pathname.split('/');
            const spotifyId = urlParts[urlParts.length - 1];

            // Ambil time_range dari URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const timeRange = urlParams.get('time_range') || 'short_term';

            // Panggil endpoint analisis emosi dengan parameter extended
            const response = await fetch('/analyze-emotions-background', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spotify_id: spotifyId,
                    time_range: timeRange,
                    extended: isExtended  // Parameter baru untuk analisis extended
                })
            });

            if (response.status === 401) {
                window.location.href = "/?error=session_expired";
                return;
            }

            const data = await response.json();

            if (data.emotion_paragraph) {
                // Ganti teks dengan hasil analisis MENGGUNAKAN EFEK KETIK
                typeEffect(emotionElement, data.emotion_paragraph);
            } else {
                // Tampilkan pesan error juga dengan efek ketik
                typeEffect(emotionElement, "Vibe analysis is currently unavailable.");
            }

        } catch (error) {
            console.warn("Could not load emotion analysis:", error);
            // Tampilkan pesan error juga dengan efek ketik
            typeEffect(emotionElement, "Vibe analysis is currently unavailable.");
        }
    }
}

// CSS untuk loading dots animation
const style = document.createElement('style');
style.textContent = `
.loading-dots {
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}

/* === SPOTIFY INTEGRATION STYLES === */
.artist-item {
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.1s ease;
    border-radius: 8px;
    position: relative;
    padding: 0.5rem;
    margin: -0.5rem;
}

.artist-item:hover::before {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    background: #1DB954;
    color: black;
    padding: 4px 8px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Track Item Styles */
.track-item {
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.1s ease;
    border-radius: 8px;
    position: relative;
    padding: 0.5rem;
    margin: -0.5rem;
}

.track-item:hover::before {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    background: #1DB954;
    color: black;
    padding: 4px 8px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.track-item.track-active {
    background-color: rgba(29, 185, 84, 0.15);
    border: 1px solid #1DB954;
    transform: translateX(4px);
}

.track-item.track-active::before {
    background: #1ed760;
}

/* Spotify Embed Container Styles */
.spotify-embed-container {
    background: #1e1e1e;
    border: 1px solid #1DB954;
    border-radius: 12px;
    margin: 10px 0;
    overflow: hidden;
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(29, 185, 84, 0.2);
}

/* Tambahkan ini untuk wrapper li baru */
.embed-list-item {
    list-style: none !important; /* Hilangkan bullet/nomor dari list */
    padding: 0 !important;
    margin: 0 !important;
}

.spotify-embed-container.embed-show {
    opacity: 1;
    transform: translateY(0);
}

.spotify-embed-container.embed-hide {
    opacity: 0;
    transform: translateY(-20px);
}

.embed-header {
    background: #1DB954;
    color: black;
    padding: 8px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 0.85rem;
}

.embed-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.embed-title::before {
    content: "♪";
    font-size: 1.1rem;
    animation: musicNote 2s ease-in-out infinite;
}

@keyframes musicNote {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-2px); }
}

.embed-close {
    background: none;
    border: none;
    color: black;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
}

.embed-close:hover {
    background-color: rgba(0, 0, 0, 0.1);
    transform: scale(1.1);
}

/* Loading dots animation */
.loading-dots {
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}

/* === SOLUSI BARU UNTUK EMBED SPOTIFY === */

/* Wrapper untuk konten asli (artwork + info) */
.track-content {
    display: flex;
    align-items: center;
    gap: 1rem;      /* Jarak antar elemen sama seperti sebelumnya */
    flex-grow: 1;   /* Memastikan ia mengisi sisa ruang */
    min-width: 0;   /* Mencegah overflow pada teks panjang */
}

/* Wadah untuk embed, tersembunyi secara default */
.embed-placeholder {
    display: none;
    flex-grow: 1;   /* Mengisi ruang yang sama dengan .track-content */
    min-width: 0;
    margin-left: -0.5rem;
}

/*
 * INI BAGIAN UTAMANYA:
 * Saat sebuah .track-item memiliki class 'embed-shown'...
 */

/* 1. Sembunyikan konten asli lagu */
.track-item.embed-shown .track-content {
    display: none;
}

/* 2. Tampilkan wadah embed */
.track-item.embed-shown .embed-placeholder {
    display: block; /* atau flex, jika perlu alignment lebih lanjut */
    font-size: 0;
    margin-top: -0.2rem;
    margin-bottom: -0.3rem;
}

/* Aturan styling untuk iframe agar pas */
.embed-placeholder iframe {
    width: 100%;
    height: 80px;
    border-radius: 8px;
    border: none;
    display: block;
    vertical-align: bottom;
}

#tracks-section li:hover,
#artists-section li:hover {
    background-color: rgba(255, 255, 255, 0.05); 
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    border-radius: 8px; /* Pastikan radius juga diaplikasikan */
}

/* === EFEK HOVER BARU UNTUK EMBED === */

/* Wadah embed perlu posisi relative untuk menampung overlay */
.embed-placeholder {
    position: relative;
}

/* Membuat lapisan overlay hijau transparan */
.embed-placeholder::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px; /* Menyesuaikan sudut iframe */

    /* Awalnya tidak terlihat dan tidak bisa diklik */
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
}

/* Saat baris <li> di-hover, tampilkan overlay-nya */
#tracks-section li:hover .embed-placeholder::after {
    opacity: 1;
}

/* === STYLING TOMBOL CLOSE EMBED === */

/* Wrapper ini diperlukan untuk positioning tombol */
.embed-wrapper {
    position: relative;
    /* Pastikan iframe tidak menutupi tombol */
    line-height: 0;
}

/* Tombol close itu sendiri */
.embed-close-btn {
    /* Positioning */
    position: absolute;
    top: 6px; /* Naikkan dikit */
    right: 6px; /* Geser ke kanan dikit */
    z-index: 5; /* Pastikan di atas iframe */

    /* Tampilan Tombol */
    background-color: rgba(255, 255, 255, 0.25); /* Putih transparan */
    color: #ffffff;
    border: none;
    border-radius: 50%; /* Bulat sempurna */
    width: 20px;
    height: 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;

    /* Menengahkan simbol '×' */
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    
    /* Efek Transisi dan Visibilitas Awal */
    opacity: 0; /* Tersembunyi secara default */
    transform: scale(0.8);
    transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
    pointer-events: none; /* Tidak bisa diklik saat tersembunyi */
}

/*
 * INI BAGIAN UTAMANYA:
 * Saat kursor hover di atas list item yang sedang aktif...
 */
.list-item.embed-shown:hover .embed-close-btn {
    opacity: 1; /* ...tampilkan tombol close */
    transform: scale(1);
    pointer-events: auto; /* ...dan buat bisa diklik */
}

/* Efek hover kecil pada tombolnya sendiri */
.embed-close-btn:hover {
    background-color: #333;
    transform: scale(1.1);
}

/* Feedback visual saat angka menjadi tombol close */
.list-item.embed-shown .rank {
    cursor: pointer;
    color: #1DB954; /* Warna hijau Spotify */
    transition: color 0.2s ease, transform 0.2s ease;
}

.list-item.embed-shown .rank:hover {
    color: #ffffff; /* Jadi putih saat disentuh */
    text-shadow: 0 0 8px rgba(29, 185, 84, 0.7);
}

/* Mobile responsive untuk embed */
@media (max-width: 768px) {
    .list-item, .track-content {
        gap: 0.5rem;
    }
    .embed-header {
        padding: 10px 15px;
        font-size: 0.8rem;
    }
    .embed-placeholder {
        margin-left: -0.5rem;
        margin-top: -0.2rem;
        margin-bottom: -0.3rem;
    }
}

/* Fix untuk "Sticky Hover" di HP/Tablet */
@media (hover: none) {
    #tracks-section li:hover,
    #artists-section li:hover,
    #genres-section li:hover {
        background-color: initial;
        transform: none;
        box-shadow: none;
    }

    /* Bonus: menonaktifkan hover di rank number juga */
    .list-item.embed-shown .rank:hover {
        color: #1DB954; /* Kembali ke warna aktif, bukan warna hover */
        text-shadow: none;
    }

    #tracks-section li:hover .embed-placeholder::after {
        opacity: 0;
    }
}
`;
document.head.appendChild(style);

// Panggil function setelah halaman dimuat
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Temukan semua elemen header
    const titleEl = document.querySelector('header h1');
    const subtitleEl = document.querySelector('header .subtitle');
    const emotionEl = document.querySelector('header .emotion-recap');

    // 2. Cek apakah elemen-elemen itu ada
    if (!titleEl || !subtitleEl || !emotionEl) {
        console.warn("Elemen header untuk efek ketik tidak ditemukan.");
        // Jika tidak ada, jalankan saja fungsi utamanya
        setTimeout(() => loadEmotionAnalysis(false), 1000);
        return;
    }

    // 3. Simpan teks asli yang dikirim dari server
    const originalTitle = titleEl.textContent;
    const originalSubtitle = subtitleEl.textContent;
    const originalEmotion = emotionEl.innerHTML; // (Teks placeholder)

    // 4. Kosongkan teksnya agar tidak "flash" (muncul sekejap)
    titleEl.textContent = '';
    subtitleEl.textContent = '';
    emotionEl.innerHTML = '';

    // 5. Jalankan sekuens mengetik satu per satu
    // (await) akan menunggu satu fungsi selesai sebelum lanjut
    await typeEffect(titleEl, originalTitle, 50);     // Kecepatan 50ms (lebih cepat)
    await typeEffect(subtitleEl, originalSubtitle, 30); // Kecepatan 30ms (normal)
    await typeEffect(emotionEl, originalEmotion, 30);   // Kecepatan 30ms (normal)

    // 6. Tampilkan footer
    const footerEl = document.querySelector('footer');
    if (footerEl) footerEl.classList.add('fade-in');

    // 7. Setelah semua teks placeholder diketik, baru kita panggil
    //    analisis emosi yang sebenarnya (sesuai delay asli 1 detik)
    setTimeout(() => loadEmotionAnalysis(false), 1000);
});

window.onload = function() {
    Chart.defaults.global.legend.display = false;

    // --- 1. SETUP CHART GENRE ---
    const ctx = document.getElementById('genreChart');
    if (ctx) {
        const chartColors = [
            '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
            '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
            '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
            '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
        ];

        currentGenreData = {
            labels: genreData.labels,
            counts: genreData.counts
        };

        currentGenreArtistsMap = genreArtistsMap;

        // 1. Buat Peta Warna (Genre -> Color) dari data chart
        const genreColorMap = new Map();
        genreDataExtended.labels.forEach((label, index) => { 
            genreColorMap.set(label, chartColors[index % chartColors.length]);
        });

        // 2. Ambil SEMUA pills genre di halaman (termasuk di Top Artists)
        const allGenrePills = document.querySelectorAll('.genre-label');
        
        // 3. Terapkan warna
        allGenrePills.forEach(pill => {
            const genreName = pill.textContent.trim();
            const color = genreColorMap.get(genreName);
            
            if (color) {
                // Terapkan warna ke Teks dan Border
                pill.style.setProperty('--genre-color', color);
            }
        });

        // Buat Chart
        genreChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: currentGenreData.labels,
                datasets: [{
                    data: currentGenreData.counts,
                    backgroundColor: chartColors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                tooltips: {
                    callbacks: {
                        footer: function(tooltipItems, data) {
                            const tooltipItem = tooltipItems[0];
                            if (!tooltipItem) return '';
                            const genre = data.labels[tooltipItem.index];
                            const artists = currentGenreArtistsMap[genre] || [];

                            if (artists.length > 0) {
                                const maxArtistsToShow = 6;
                                let artistList = artists.slice(0, maxArtistsToShow).map(artist => `• ${artist}`);
                                if (artists.length > maxArtistsToShow) {
                                    artistList.push(`• and ${artists.length - maxArtistsToShow} more...`);
                                }
                                return artistList;
                            }
                            return '';
                        }
                    }
                }
            }
        });

        // Sembunyikan slice > 10 di awal
        genreChartInstance.getDatasetMeta(0).data.forEach((slice, index) => {
            if (index >= 10) {
                slice.hidden = true;
            }
        });
        genreChartInstance.update();

        // Setup interaktivitas list genre
        const genreListItems = document.querySelectorAll('#genres-section li');
        genreListItems.forEach((item) => {
            const itemIndex = parseInt(item.getAttribute('data-index'));
            const colorLabel = item.querySelector('.genre-color-label');
            if (colorLabel) {
                colorLabel.style.backgroundColor = chartColors[itemIndex % chartColors.length];
            }

            item.addEventListener('click', function() {
                const meta = genreChartInstance.getDatasetMeta(0);
                if (meta.data[itemIndex]) {
                    meta.data[itemIndex].hidden = !meta.data[itemIndex].hidden;
                    this.classList.toggle('disabled');
                    genreChartInstance.update();
                }
            });
        });
    }

    checkScreenSize();

    // --- 2. EASTER EGG LOGIC (FIXED) ---
    let easterEggClicked = false;
    document.querySelectorAll('.footer-toggler').forEach(toggler => {
        toggler.addEventListener('click', function() {
            if (easterEggClicked) return;

            // Tampilkan item Artists & Tracks yang tersembunyi
            ['artists-section', 'tracks-section'].forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (section) {
                    const hiddenItems = section.querySelectorAll('.hidden-item');
                    hiddenItems.forEach((item, idx) => {
                        item.style.animationDelay = `${idx * 0.1}s`;
                        item.style.display = 'list-item';
                    });
                }
            });

            // Update Genre Chart & List (Top 20)
            if (genreChartInstance && genreDataExtended) {
                currentGenreData = genreDataExtended;
                currentGenreArtistsMap = genreArtistsMapExtended;

                genreChartInstance.data.labels = genreDataExtended.labels;
                genreChartInstance.data.datasets[0].data = genreDataExtended.counts;

                genreChartInstance.getDatasetMeta(0).data.forEach((slice) => {
                    slice.hidden = false;
                });
                genreChartInstance.update();

                updateGenreList(genreDataExtended.labels, genreDataExtended.counts);
            }

            loadEmotionAnalysis(true);
            easterEggClicked = true;
        });
    });

    // --- 3. FETCH DATA (SUDAH DIPERBAIKI) ---
    // Bagian ini sebelumnya yang bikin error (nongol duluan).
    // Sekarang kita fetch datanya tapi JANGAN update teks emosi secara paksa.
    const urlParts = window.location.pathname.split('/');
    const spotifyId = urlParts[urlParts.length - 1];
    const urlParams = new URLSearchParams(window.location.search);
    const timeRange = urlParams.get('time_range') || 'short_term';

    fetch(`/top-data?spotify_id=${spotifyId}&time_range=${timeRange}`)
      .then(res => {
          if (res.status === 401) {
              window.location.href = "/?error=session_expired";
              return null; // Stop proses
          }
          return res.json();
      })
      .then(data => {
          // KITA KOSONGKAN BAGIAN INI.
          // Biarkan animasi typing di DOMContentLoaded yang menangani teksnya.
          // Jangan ada kode: document.querySelector(...).innerHTML = ...
      })
      .catch(err => console.error("Error fetching top data:", err));
};

// Fungsi helper untuk update genre list
function updateGenreList(labels, counts) {
    const genreList = document.querySelector('#genres-section .list-container');
    if (!genreList) return;

    const chartColors = [
        '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
        '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
        '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
    ];

    genreList.innerHTML = labels.map((label, index) => {
        const artists = genreArtistsMapExtended[label] || [];
        const artistText = artists.length > 0 ? `: ${artists.join(', ')}` : '';

        // === PERBAIKAN DI BLOK INI ===
        let animStyle = ''; // Untuk delay
        let animClass = ''; // Untuk mematikan animasi

        if (index < 10) {
            // Pakai CLASS, bukan style (biar 1-10 gak fade in ulang pas easter egg)
            animClass = 'no-animation';
        } else {
            // Item 11-20 tetap pakai inline style untuk delay
            const delay = (index - 10) * 0.1;
            animStyle = `animation-delay: ${delay}s;`;
        }
        // === AKHIR PERBAIKAN ===

        return `
            <li data-index="${index}" class="${animClass}" style="${animStyle}">
                <div class="list-item">
                    <span class="rank">${index + 1}</span>
                    <div class="info">
                        <div class="name-container">
                            <span class="genre-color-label" style="background-color: ${chartColors[index % chartColors.length]}"></span>
                            <span class="name">${label}</span>
                        </div>
                        <div class="meta">
                            Mentioned ${counts[index]} times${artistText}
                        </div>
                    </div>
                </div>
            </li>
        `;
    }).join('');

    // Pasang ulang event listener
    document.querySelectorAll('#genres-section li').forEach((item) => {
        const itemIndex = parseInt(item.getAttribute('data-index'));
        item.addEventListener('click', function() {
            const meta = genreChartInstance.getDatasetMeta(0);
            if (meta.data[itemIndex]) {
                meta.data[itemIndex].hidden = !meta.data[itemIndex].hidden;
                this.classList.toggle('disabled');
                genreChartInstance.update();
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    
    /* =========================================
       LOGIC 1: Typewriter (Spotify <-> HF)
       ========================================= */
    const providerLink = document.getElementById('provider-link');
    const providerData = [
        { text: 'Spotify API', url: 'https://developer.spotify.com/', type: 'spotify' },
        { text: 'Hugging Face', url: 'https://huggingface.co/', type: 'huggingface' }
    ];

    let typeLoop = 0;
    let isDeleting = false;
    let txt = '';
    
    // Config Speed
    const typingSpeed = 100; 
    const deletingSpeed = 50;
    const pauseTime = 2500; 

    function typeWriter() {
        const i = typeLoop % providerData.length;
        const fullTxt = providerData[i].text;

        if (isDeleting) {
            txt = fullTxt.substring(0, txt.length - 1);
        } else {
            txt = fullTxt.substring(0, txt.length + 1);
        }

        providerLink.textContent = txt;

        let delta = isDeleting ? deletingSpeed : typingSpeed;

        if (!isDeleting && txt === fullTxt) {
            delta = pauseTime; 
            isDeleting = true;
            updateProviderStyle(i); // Pastikan link benar saat teks utuh
        } else if (isDeleting && txt === '') {
            isDeleting = false;
            typeLoop++;
            delta = 500;
            // Ganti link & warna saat teks kosong (sebelum ngetik baru)
            updateProviderStyle(typeLoop % providerData.length);
        }

        setTimeout(typeWriter, delta);
    }

    function updateProviderStyle(index) {
        const data = providerData[index];
        providerLink.href = data.url;
        if (data.type === 'huggingface') {
            providerLink.classList.add('hf-mode');
        } else {
            providerLink.classList.remove('hf-mode');
        }
    }

    // Jalankan Typewriter
    if(providerLink) typeWriter();


    /* =========================================
       LOGIC 2: Fade (Lyrics <-> Aritsu)
       ========================================= */
    const dynamicContainer = document.getElementById('dynamic-footer-link');
    let isLyricsState = false; // Kita mulai dari false biar logic di bawah langsung switch ke true

    // Set tampilan awal
    if(dynamicContainer) {
        dynamicContainer.innerHTML = '<a href="/lyrics" class="footer-link">Lyrics Analyzer</a>';
    
        setInterval(() => {
            // 1. Fade Out
            dynamicContainer.classList.add('fading-out');

            // 2. Ganti Konten
            setTimeout(() => {
                if (isLyricsState) {
                    // Balik ke Lyrics (Semua jadi Link Hijau)
                    dynamicContainer.innerHTML = '<a href="/lyrics" class="footer-link">Lyrics Analyzer</a>';
                } else {
                    // Ganti ke Aritsu (Teks biasa + Link Hijau di Nama)
                    // Perhatikan: "Created by" diluar tag <a>
                    dynamicContainer.innerHTML = 'Created by <a href="https://desty.page/anggars" target="_blank" class="footer-link">アリツ</a>';
                }

                isLyricsState = !isLyricsState;
                
                // 3. Fade In
                dynamicContainer.classList.remove('fading-out');
            }, 500); // Tunggu CSS transition selesai

        }, 5000); // Ganti setiap 5 detik
    }

    // --- NEW: CURSOR FOLLOW GLOW LOGIC (Dashboard) ---
    const downloadBtn = document.querySelector('.download-btn');
    const modalButtons = document.querySelectorAll('.modal-options button');
    const listItems = document.querySelectorAll('.list-container li');
    const elementsToGlow = [downloadBtn, ...modalButtons, ...listItems];
    elementsToGlow.forEach(el => {
        if (el) {
            // [LOGIC MOUSE LAMA TETAP ADA]
            el.addEventListener('mousemove', (e) => updateGlow(e, el));
            el.addEventListener('mouseleave', () => {
            });
            
            // [BARU: TOUCH EVENTS]
            el.addEventListener('touchstart', (e) => updateGlow(e, el));
            el.addEventListener('touchmove', (e) => updateGlow(e, el));
            el.addEventListener('touchend', () => {
            });
        }
    });
    
    const footerEl = document.querySelector('footer');
    const container = document.getElementById('dashboard');

    // Cek dulu elemennya ada gak
    if (!footerEl || !downloadBtn) return;

    const observer = new IntersectionObserver((entries) => {
        // Hanya jalankan logic di layar HP
        if (window.innerWidth > 768) {
            downloadBtn.classList.remove('hide-on-scroll');
            if (container) container.classList.remove('footer-visible');
            return;
        }

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Footer MULAI MUNCUL di layar -> Sembunyikan Tombol
                downloadBtn.classList.add('hide-on-scroll');
                if (container) container.classList.add('footer-visible');
            } else {
                // Footer KELUAR dari layar -> Munculkan Tombol
                downloadBtn.classList.remove('hide-on-scroll');
                if (container) container.classList.remove('footer-visible');
            }
        });
    }, {
        root: null,   // viewport browser
        threshold: 0.1 // Trigger saat 10% footer nongol dikit aja
    });

    observer.observe(footerEl);
});

/* =========================================
   LOGIC: SMART MARQUEE (FINAL)
   - Hapus animasi hover CSS (DONE via CSS)
   - Tunggu Font Ready (Akurasi Tinggi)
   - Buffer 15px (Anti gerak teks pendek)
   ========================================= */
function setupMarquee() {
    // 1. CLEANUP: Reset semua animasi & masking lama
    document.querySelectorAll('.scroll-active').forEach(el => {
        el.classList.remove('scroll-active');
        el.style.removeProperty('--scroll-distance');
        el.style.removeProperty('--scroll-duration');
        
        // Hapus mask dari parent (biar gak ngeblur pas diem)
        if (el.parentElement.classList.contains('mask-active')) {
            el.parentElement.classList.remove('mask-active');
        }
    });

    // 2. TARGET: Pilih elemen yang BOLEH gerak
    const titles = document.querySelectorAll('#artists-section .info .name, #tracks-section .info .name');
    
    const trackMetas = document.querySelectorAll('#tracks-section .info .meta');
    const albumMetas = Array.from(trackMetas).filter(el => 
        el.textContent.trim().startsWith("Album:")
    );

    const allowedElements = [...titles, ...albumMetas];

    // 3. EKSEKUSI (Tunggu Font Siap)
    document.fonts.ready.then(() => {
        allowedElements.forEach(el => {
            // Ambil ukuran (bulatkan ke atas)
            const scrollWidth = Math.ceil(el.scrollWidth);
            const clientWidth = Math.ceil(el.clientWidth);

            // LOGIC FIX: Buffer cuma 2px (biar Desktop Sensitif)
            // Kalau selisih > 2px, langsung jalan!
            if (scrollWidth > clientWidth + 2) {
                
                const distance = scrollWidth - clientWidth + 30; // Jarak geser + space
                
                // Kecepatan santai (makin kecil pembagi, makin pelan)
                const duration = Math.max(distance / 25, 6);   
                
                el.style.setProperty('--scroll-distance', `-${distance}px`);
                el.style.setProperty('--scroll-duration', `${duration}s`);
                
                // 1. Aktifkan Animasi Gerak
                el.classList.add('scroll-active');

                // 2. Aktifkan Fadeout Masking (Cuma kalau gerak!)
                el.parentElement.classList.add('mask-active');
            }
        });
    });
}

// === TRIGGERS ===
document.addEventListener('DOMContentLoaded', setupMarquee);
window.addEventListener('load', setupMarquee); // Backup kalau font telat

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupMarquee, 200);
});

document.querySelectorAll('.footer-toggler, .show-more').forEach(btn => {
    btn.addEventListener('click', () => {
        setTimeout(setupMarquee, 600); 
    });
});