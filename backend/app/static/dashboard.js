let genreChartInstance = null;
const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:8000' : '';
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

    // INI BAGIAN YANG DIPERBAIKI:
    // Pengecekan sekarang lebih lengkap
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

// Ganti hanya isi fungsi generateImage ini
function generateImage(selectedCategory) {
    hideSaveOptions();
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
    // ▼▼▼ PERBAIKAN #1: Container luar menjadi acuan posisi ▼▼▼
    container.style.position = 'relative';

    const contentWrapper = document.createElement("div");
    contentWrapper.style.padding = "80px 40px 40px 40px";
    contentWrapper.style.boxSizing = "border-box";
    contentWrapper.style.width = '100%';
    // ▼▼▼ PERBAIKAN #2: Terapkan trik absolute centering ▼▼▼
    contentWrapper.style.position = 'absolute';
    contentWrapper.style.top = '50%';
    contentWrapper.style.left = '50%';
    contentWrapper.style.transform = 'translate(-50%, -50%)'; // Ini kuncinya

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

        // ▼▼▼ PERBAIKAN #3: Gabungkan scale dengan transform yang sudah ada ▼▼▼
        const contentHeight = contentWrapper.offsetHeight;
        if (contentHeight > STORY_HEIGHT) {
            const scale = STORY_HEIGHT / contentHeight;
            // Gabungkan centering dan scaling dalam satu perintah transform
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

    // 4. FUNGSI "HIDDEN GEM" SEKARANG LEBIH SIMPEL
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
            
            easterEggClicked = true;
        });
    });
};