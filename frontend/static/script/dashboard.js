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
    for (const key in sections) {
        sections[key].classList.remove("active");
    }
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
            sections[key].classList.remove("active");
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

function generateImage(selectedCategory) {
    hideSaveOptions();
    
    // IMPORTANT: Tutup embed yang terbuka sebelum screenshot
    closeCurrentEmbed();
    
    document.body.classList.add('force-desktop-view');

    // Sembunyikan semua section
    for (const key in sections) {
        sections[key].style.display = "none";
    }
    const sectionToCapture = sections[selectedCategory];
    sectionToCapture.style.display = "block";

    // Sembunyikan item > 10
    const allItems = sectionToCapture.querySelectorAll('ol.list-container > li');
    allItems.forEach((item, index) => {
        if (index >= 10) item.style.display = 'none';
    });
    const showMoreContainer = sectionToCapture.querySelector('.show-more-container');
    if (showMoreContainer) showMoreContainer.style.display = 'none';

    const clone = sectionToCapture.cloneNode(true);

    if (selectedCategory === 'genres') {
        const originalCanvas = document.getElementById('genreChart');
        const clonedCanvas = clone.querySelector('#genreChart');
        if (originalCanvas && clonedCanvas) {
            const chartImage = new Image();
            chartImage.src = originalCanvas.toDataURL('image/png');
            chartImage.style.width = '100%';
            chartImage.style.height = 'auto';
            chartImage.style.display = 'block';
            chartImage.style.margin = clonedCanvas.style.margin;
            clonedCanvas.parentNode.replaceChild(chartImage, clonedCanvas);
        }
    }

    // --- LOGIKA PEMBUATAN CONTAINER GAMBAR ---
    const STORY_WIDTH = 720;
    const STORY_HEIGHT = 1280;

    const container = document.createElement("div");
    container.style.width = `${STORY_WIDTH}px`;
    container.style.height = `${STORY_HEIGHT}px`;
    container.style.background = "#121212";
    container.style.color = "#fff";
    container.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    const contentWrapper = document.createElement("div");
    contentWrapper.style.padding = "80px 40px 40px 40px";
    contentWrapper.style.boxSizing = "border-box";
    contentWrapper.style.width = '100%';
    contentWrapper.style.position = 'absolute';
    contentWrapper.style.top = '50%';
    contentWrapper.style.left = '50%';
    contentWrapper.style.transform = 'translate(-50%, -50%)';

    const pageHeader = document.querySelector('header');
    const headerClone = pageHeader.cloneNode(true);
    headerClone.style.textAlign = 'center';
    headerClone.style.marginBottom = '1.5rem';
    contentWrapper.appendChild(headerClone);
    contentWrapper.appendChild(clone);
    
    const footer = document.createElement("div");
    footer.innerHTML = `Personalify © 2025 • <a href="https://developer.spotify.com/" target="_blank" style="color: #888; text-decoration: none;">Powered by Spotify API</a>`;
    footer.style.paddingTop = "2rem";
    footer.style.marginTop = "auto";
    footer.style.fontSize = "0.75rem";
    footer.style.color = "#888";
    footer.style.textAlign = "center";
    contentWrapper.appendChild(footer);

    container.appendChild(contentWrapper);

    function renderCanvas() {
        document.body.appendChild(container);

        const contentHeight = contentWrapper.offsetHeight;
        if (contentHeight > STORY_HEIGHT) {
            const scale = STORY_HEIGHT / contentHeight;
            contentWrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }

        html2canvas(container, {
            scale: 2, useCORS: true, backgroundColor: '#121212'
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = `personalify-${selectedCategory}-${new Date().getTime()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            document.body.classList.remove('force-desktop-view');
            document.body.removeChild(container);
            checkScreenSize();
        }).catch(err => {
            console.error("html2canvas failed:", err);
            document.body.classList.remove('force-desktop-view');
            if (document.body.contains(container)) {
                 document.body.removeChild(container);
            }
            checkScreenSize();
        });
    }

    const imgs = clone.querySelectorAll('img');
    if (imgs.length === 0) {
        renderCanvas();
    } else {
        let loadedCount = 0;
        imgs.forEach(img => {
            const newImg = new Image();
            newImg.crossOrigin = "anonymous";
            newImg.src = img.src;
            const checkDone = () => {
                loadedCount++;
                if (loadedCount === imgs.length) renderCanvas();
            };
            newImg.onload = checkDone;
            newImg.onerror = checkDone;
        });
    }
}

document.getElementById('save-artists-btn').addEventListener('click', () => generateImage('artists'));
document.getElementById('save-tracks-btn').addEventListener('click', () => generateImage('tracks'));
document.getElementById('save-genres-btn').addEventListener('click', () => generateImage('genres'));

modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        hideSaveOptions();
    }
});

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
            
            const data = await response.json();
            
            if (data.emotion_paragraph) {
                // Ganti teks dengan hasil analisis
                emotionElement.innerHTML = data.emotion_paragraph;
            } else {
                emotionElement.textContent = "Vibe analysis is currently unavailable.";
            }
            
        } catch (error) {
            console.warn("Could not load emotion analysis:", error);
            emotionElement.textContent = "Vibe analysis is currently unavailable.";
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

.artist-item:hover {
    background-color: rgba(29, 185, 84, 0.1);
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(29, 185, 84, 0.2);
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

.track-item:hover {
    background-color: rgba(29, 185, 84, 0.1);
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(29, 185, 84, 0.2);
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
}

/* Aturan styling untuk iframe agar pas */
.embed-placeholder iframe {
    width: 100%;
    height: 80px; /* Tinggi ideal untuk pemutar Spotify yang compact */
    border-radius: 8px; /* Sudut sedikit melengkung agar lebih modern */
    border: none;
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
    top: 8px;
    right: 8px;
    z-index: 5;
    background-color: #333;

    /* Tampilan Tombol */
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 50%; /* Bulat sempurna */
    width: 24px;
    height: 24px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    
    /* Menengahkan simbol '×' */
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding-bottom: 2px; /* Koreksi posisi vertikal simbol */

    /* Efek Transisi dan Visibilitas Awal */
    opacity: 0; /* Tersembunyi secara default */
    transform: scale(0.8);
    transition: opacity 0.2s ease, transform 0.2s ease;
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
    }
}

/* Fix untuk "Sticky Hover" di HP/Tablet */
@media (hover: none) {
    .track-item:hover,
    .artist-item:hover,
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
}
`;
document.head.appendChild(style);

// Panggil function setelah halaman dimuat dengan delay kecil
document.addEventListener('DOMContentLoaded', function() {
    // Delay 1 detik agar user bisa lihat dashboard dulu
    setTimeout(loadEmotionAnalysis, 1000);
});

window.onload = function() {
    // Perintah global untuk memastikan legenda TIDAK PERNAH muncul
    Chart.defaults.global.legend.display = false;
    
    const ctx = document.getElementById('genreChart');
    if (ctx) {
        const chartColors = [
            '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
            '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
            '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
            '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
        ];

        // 1. BUAT CHART DENGAN SEMUA DATA (TOP 20)
        genreChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: genreData.labels,
                datasets: [{
                    data: genreData.counts,
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
                            const artists = genreArtistsMap[genre] || [];
                            
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

        // 2. SEMBUNYIKAN SLICE DI ATAS 10 SECARA MANUAL
        genreChartInstance.getDatasetMeta(0).data.forEach((slice, index) => {
            if (index >= 10) {
                slice.hidden = true;
            }
        });
        genreChartInstance.update(); // Terapkan perubahan

        // 3. SINKRONISASI WARNA DAN INTERAKTIVITAS LEGENDA KUSTOM
        const genreListItems = document.querySelectorAll('#genres-section li');
        genreListItems.forEach((item) => {
            const itemIndex = parseInt(item.getAttribute('data-index'));

            const colorLabel = item.querySelector('.genre-color-label');
            if (colorLabel) {
                colorLabel.style.backgroundColor = chartColors[itemIndex % chartColors.length];
            }

            // Fungsi klik sekarang akan bekerja untuk semua item
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

    // 4. FUNGSI "HIDDEN GEM" DENGAN ANALISIS EMOSI EXTENDED
    let easterEggClicked = false;
    document.querySelectorAll('.footer-toggler').forEach(toggler => {
        toggler.addEventListener('click', function() {
            if (easterEggClicked) return;

            document.querySelectorAll('.hidden-item').forEach(item => {
                item.style.display = 'list-item';
            });
            
            // Kita hanya perlu memunculkan kembali semua slice yang tersembunyi
            genreChartInstance.getDatasetMeta(0).data.forEach((slice) => {
                slice.hidden = false;
            });
            genreChartInstance.update();
            
            // TAMBAHAN: Trigger analisis emosi untuk 20 lagu
            loadEmotionAnalysis(true); // Parameter true untuk extended analysis
            
            easterEggClicked = true;
        });
    });
};
