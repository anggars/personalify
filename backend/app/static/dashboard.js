const categoryFilterSelect = document.getElementById("category-filter");
const categoryFilterWrapper = document.getElementById("category-filter-wrapper");
const sections = {
    artists: document.getElementById("artists-section"),
    tracks: document.getElementById("tracks-section"),
    genres: document.getElementById("genres-section")
};
const modal = document.getElementById("save-modal-overlay");

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
    
    const timeText = document.querySelector('#time-filter option:checked').textContent;
    const username = document.querySelector('h1').innerText;

    for (const key in sections) {
        sections[key].style.display = "none";
    }

    const sectionToCapture = sections[selectedCategory];
    sectionToCapture.style.display = "block";

    const clone = sectionToCapture.cloneNode(true);

    // --- OPTIMISASI UNTUK MENGATASI LAG ---
    // Jika kategori adalah 'artists', hapus elemen genre yang rumit dari 'clone'
    if (selectedCategory === 'artists') {
        const artistClones = clone.querySelectorAll('.artist');
        artistClones.forEach(artistClone => {
            // Cari div.meta pertama yang berisi genre
            const genreMeta = artistClone.querySelector('.meta:first-of-type');
            if (genreMeta) {
                genreMeta.parentNode.removeChild(genreMeta); // Hapus seluruh div genre
            }
        });
    }
    // --- AKHIR OPTIMISASI ---

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

    const container = document.createElement("div");
    container.style.width = "720px";
    container.style.background = "#121212";
    container.style.padding = "1.5rem";
    container.style.boxSizing = "border-box";
    container.style.color = "#fff";
    container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    const title = document.createElement("h1");
    title.innerText = "Personalify";
    title.style.textAlign = "center";
    title.style.color = "#1DB954";
    title.style.marginBottom = "1rem";
    container.appendChild(title);

    const welcome = document.createElement("h2");
    welcome.innerText = username;
    welcome.style.textAlign = "center";
    welcome.style.fontSize = "1rem";
    welcome.style.color = "#ccc";
    welcome.style.marginBottom = "0.75rem";
    container.appendChild(welcome);

    const timeLabel = document.createElement("div");
    timeLabel.innerText = timeText;
    timeLabel.style.textAlign = "center";
    timeLabel.style.fontSize = "0.9rem";
    timeLabel.style.color = "#aaa";
    timeLabel.style.marginBottom = "1rem";
    container.appendChild(timeLabel);

    container.appendChild(clone);

    const footer = document.createElement("div");
    footer.innerText = "Personalify © 2025 • Powered by Spotify API";
    footer.style.marginTop = "2rem";
    footer.style.fontSize = "0.75rem";
    footer.style.color = "#888";
    footer.style.textAlign = "center";
    container.appendChild(footer);

    function renderCanvas() {
        document.body.appendChild(container);
        html2canvas(container, {
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = `personalify-${selectedCategory}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            document.body.removeChild(container);
            checkScreenSize();
        });
    }

    const imgs = clone.querySelectorAll('img');
    if (imgs.length === 0) {
        renderCanvas();
    } else {
        let loadedCount = 0;
        imgs.forEach(img => {
            const tempImg = new Image();
            tempImg.crossOrigin = "anonymous";
            tempImg.src = img.src;
            tempImg.onload = () => {
                loadedCount++;
                if (loadedCount === imgs.length) renderCanvas();
            };
            tempImg.onerror = () => {
                loadedCount++;
                if (loadedCount === imgs.length) renderCanvas();
            };
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

        const data = {
            labels: genreData.labels,
            datasets: [{
                data: genreData.counts,
                backgroundColor: [
                    '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
                    '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
                ]
            }]
        };

        new Chart(ctx, {
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
                    }
                }
            }
        });
    }
    checkScreenSize();
};