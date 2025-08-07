let genreChartInstance = null;

const categoryFilterSelect = document.getElementById("category-filter");
const categoryFilterWrapper = document.getElementById("category-filter-wrapper");
const sections = {
    artists: document.getElementById("artists-section"),
    tracks: document.getElementById("tracks-section"),
    genres: document.getElementById("genres-section")
};
const modal = document.getElementById("save-modal-overlay");

// ... setelah const modal = ...
// TAMBAHKAN FUNGSI BARU INI
function updateGenreChart(newLabels, newCounts) {
    if (!genreChartInstance) return;

    // Sediakan daftar warna yang lebih panjang untuk 20 item
    const fullColorList = [
        '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
        '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
        '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
    ];

    genreChartInstance.data.labels = newLabels;
    genreChartInstance.data.datasets[0].data = newCounts;
    // Perbarui juga warnanya agar cukup untuk data baru
    genreChartInstance.data.datasets[0].backgroundColor = fullColorList;
    
    genreChartInstance.update(); // Perintah untuk me-render ulang chart
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

function generateImage(selectedCategory) {
    hideSaveOptions();

    // Sembunyikan semua section dulu
    for (const key in sections) {
        sections[key].style.display = "none";
    }

    // Siapkan section yang akan di-capture
    const sectionToCapture = sections[selectedCategory];
    sectionToCapture.style.display = "block";

     // Sembunyikan item lebih dari 10 sebelum meng-clone untuk gambar
    const allItems = sectionToCapture.querySelectorAll('ol.list-container > li');
    allItems.forEach((item, index) => {
        if (index >= 10) {
            item.style.display = 'none';
        }
    });
    // Sembunyikan juga tombol "Show More" dari gambar
    const showMoreContainer = sectionToCapture.querySelector('.show-more-container');
    if (showMoreContainer) {
        showMoreContainer.style.display = 'none';
    }

    const clone = sectionToCapture.cloneNode(true);

    // Khusus untuk genre, ganti canvas dengan gambar statis
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

    // -- LOGIKA BARU UNTUK INSTAGRAM STORY --
    const STORY_WIDTH = 720;
    const STORY_HEIGHT = 1280;

    const container = document.createElement("div");
    container.style.width = `${STORY_WIDTH}px`;
    container.style.height = `${STORY_HEIGHT}px`;
    container.style.background = "#121212";
    container.style.color = "#fff";
    container.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    container.style.overflow = 'hidden';

    const contentWrapper = document.createElement("div");
    contentWrapper.style.padding = "80px 40px 40px 40px";
    contentWrapper.style.boxSizing = "border-box";
    contentWrapper.style.width = '100%';
    
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

    // Proses rendering menjadi gambar
    function renderCanvas() {
        document.body.appendChild(container);

        // --- PERBAIKAN KUNCI: Pengukuran dan scaling dipindah ke sini ---
        // Ini memastikan pengukuran dilakukan SETELAH semua gambar dimuat
        const contentHeight = contentWrapper.scrollHeight;
        if (contentHeight > STORY_HEIGHT) {
            const scale = STORY_HEIGHT / contentHeight;
            contentWrapper.style.transform = `scale(${scale})`;
            contentWrapper.style.transformOrigin = 'top center';
        }
        // --- AKHIR PERBAIKAN ---

        html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#121212'
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = `personalify-${selectedCategory}-${new Date().getTime()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            document.body.removeChild(container);
            checkScreenSize();
        });
    }

    // Tunggu semua gambar di dalam konten dimuat sebelum render
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
                if (loadedCount === imgs.length) {
                    renderCanvas();
                }
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
    const ctx = document.getElementById('genreChart');
    if (ctx) {
        
        const legendMarginPlugin = {
            id: 'legendMargin',
            beforeInit(chart, args, options) {
                if (chart.legend.options.position === 'top') {
                    const originalFit = chart.legend.fit;
                    chart.legend.fit = function() {
                        originalFit.bind(chart.legend)();
                        this.height += 25;
                    }
                }
            }
        };

        // ▼▼▼ PERBAIKAN UTAMA DI SINI ▼▼▼
        // Ambil hanya 10 data teratas untuk ditampilkan di chart
        const top10Labels = genreData.labels.slice(0, 10);
        const top10Counts = genreData.counts.slice(0, 10);
        const top10Colors = [
            '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
            '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
        ];
        // ▲▲▲ AKHIR PERBAIKAN ▲▲▲

        const data = {
            labels: top10Labels, // Gunakan data yang sudah dipotong
            datasets: [{
                data: top10Counts, // Gunakan data yang sudah dipotong
                backgroundColor: top10Colors
            }]
        };

        genreChartInstance = new Chart(ctx, {
            type: 'pie',
            data: data,
            plugins: [legendMarginPlugin],
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#fff',
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            footer: function(tooltipItems) {
                                const genre = tooltipItems[0].label;
                                const artists = genreArtistsMap[genre] || [];
                                const artistList = artists.map(artist => `• ${artist}`);
                                return artistList;
                            }
                        }
                    }
                }
            }
        });
    }
    checkScreenSize();

    // FUNGSI FINAL UNTUK "HIDDEN GEM" DI FOOTER (VERSI BARU)
    document.querySelectorAll('.footer-toggler').forEach(toggler => {
        toggler.addEventListener('click', function() {
            // Tampilkan semua item yang tersembunyi
            document.querySelectorAll('.hidden-item').forEach(item => {
                item.style.display = 'list-item';
            });
            
            // Panggil fungsi update dengan data lengkap
            updateGenreChart(genreData.labels, genreData.counts);
        });
    });
};