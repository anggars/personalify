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
    woff2Url: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans@5.0.19/files/plus-jakarta-sans-latin-wght-normal.woff2'
};

let cachedFontCSS = null;

function setupCustomDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-select');

    const closeDropdown = (dropdown) => {
        if (!dropdown.classList.contains('active')) return;

        dropdown.classList.add('closing');

        setTimeout(() => {
            dropdown.classList.remove('active');
            dropdown.classList.remove('closing');
        }, 190);
    };

    const openDropdown = (dropdown) => {
        dropdown.classList.add('active');
        dropdown.classList.remove('closing');
    };

    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.select-trigger');
        const options = dropdown.querySelectorAll('.custom-option');
        const textSpan = trigger.querySelector('span:first-child');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const isActive = dropdown.classList.contains('active');

            dropdowns.forEach(d => {
                if (d !== dropdown && d.classList.contains('active')) {
                    closeDropdown(d);
                }
            });

            if (isActive) {
                closeDropdown(dropdown);
            } else {
                openDropdown(dropdown);
            }
        });

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                textSpan.textContent = option.textContent;
                const value = option.getAttribute('data-value');
                
                closeDropdown(dropdown);

                if (dropdown.id === 'time-filter-wrapper') {
                    const currentURL = window.location.href.split('?')[0].split('#')[0];
                    const userId = currentURL.split('/').pop();
                    window.location.href = `/dashboard/${userId}?time_range=${value}`;
                }

                if (dropdown.id === 'category-filter-wrapper') {
                   updateCategoryDisplay(value);
                }
            });
        });
    });

    document.addEventListener('click', (e) => {
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target) && dropdown.classList.contains('active')) {
                closeDropdown(dropdown);
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupCustomDropdowns();
    checkScreenSize();
});

window.addEventListener("resize", checkScreenSize);

function updateCategoryDisplay(selectedValue) {
    if (!selectedValue) {
        const activeOption = document.querySelector('#category-filter-wrapper .custom-option.selected');
        selectedValue = activeOption ? activeOption.getAttribute('data-value') : 'tracks';
    }

    const genreItems = sections.genres.querySelectorAll('li.no-animation');
    genreItems.forEach(item => {
        item.classList.remove('no-animation');
    });

    for (const key in sections) {
        sections[key].classList.remove("active");
    }

    if (sections[selectedValue]) {
        sections[selectedValue].classList.add("active");
    }
}

function checkScreenSize() {
    if (window.innerWidth <= 768) {
        if(categoryFilterWrapper) {
            categoryFilterWrapper.style.display = "inline-block";
        }
        updateCategoryDisplay();
    } else {
        for (const key in sections) {
            sections[key].style.display = "block";
            sections[key].classList.add("active");
        }
        if(categoryFilterWrapper) {
            categoryFilterWrapper.style.display = "none";
        }
    }
}

document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && 
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_')) {
        e.preventDefault();
    }
});

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

function updateGlow(e, el) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    if (clientX === undefined) return; 

    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * 100;
    const y = (clientY - rect.top) / el.clientHeight * 100; 
    
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
};

function typeEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        let index = 0;
        let currentHtml = '';
        
        const oldCursor = element.querySelector('.typing-cursor');
        if (oldCursor) {
            oldCursor.remove();
        }
        
        element.innerHTML = '';

        function typeWriter() {
            if (index < text.length) {
                let char = text.charAt(index);

                if (char === '<') {
                    let tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        let tag = text.substring(index, tagEnd + 1);
                        currentHtml += tag;
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

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    
    genreChartInstance.data.datasets[0].backgroundColor = fullColorList.map(c => hexToRgba(c, 0.6));
    genreChartInstance.data.datasets[0].borderColor = 'rgba(255, 255, 255, 0.2)';
    genreChartInstance.data.datasets[0].borderWidth = 1;

    genreChartInstance.update();
}

window.addEventListener("resize", checkScreenSize);
document.addEventListener("DOMContentLoaded", checkScreenSize);

function toggleMore(index, el) {
    const more = document.getElementById("more-" + index);
    const isVisible = more.style.display === "inline";
    more.style.display = isVisible ? "none" : "inline";
    el.textContent = isVisible ? "+ more" : "− less";
}


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

    if (listItem && listItem.classList.contains('embed-shown')) {
        event.stopPropagation();

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
    const modal = document.getElementById("save-modal-overlay");
    
    if (event.key === 'Escape' && modal.style.display === 'flex') {
        hideSaveOptions();
    }
});

async function generateImage(selectedCategory) {
    hideSaveOptions();
    closeCurrentEmbed();
    document.body.style.overflow = 'hidden'; 
    document.body.style.touchAction = 'none';
    
    const loadingOverlay = document.createElement('div');
Object.assign(loadingOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#121212',
    zIndex: '2147483647', 
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#ffffff',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 'bold',
    transition: 'opacity 0.3s ease'
});

loadingOverlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
loadingOverlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes overlay-rotate { 100% { transform: rotate(360deg); } }
    @keyframes overlay-dash {
        0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
        50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
        100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
    }
    .overlay-spinner {
        width: 25px; 
        height: 25px;
        animation: overlay-rotate 2s linear infinite;
    }
    .overlay-spinner .path {
        stroke: #ffffff;
        stroke-width: 4;
        stroke-linecap: round;
        fill: none;
        animation: overlay-dash 1.5s ease-in-out infinite;
    }
`;
document.head.appendChild(spinnerStyle);

loadingOverlay.innerHTML = `
    <div style="margin-bottom: 20px; font-size: 1.2rem; text-align: center;">Processing Image...</div>
    
    <svg class="overlay-spinner" viewBox="0 0 50 50">
        <circle class="path" cx="25" cy="25" r="20"></circle>
    </svg>

    <div style="margin-top: 20px; font-size: 0.8rem; color: #888;">Please wait!</div>
`;

document.body.appendChild(loadingOverlay);

    document.body.classList.add('force-desktop-view');
    document.body.classList.add('download-mode');

    for (const key in sections) { 
        sections[key].dataset.originalDisplay = sections[key].style.display;
        sections[key].style.display = "none"; 
    }
    const sectionToCapture = sections[selectedCategory];
    sectionToCapture.style.display = "block";

    const clone = sectionToCapture.cloneNode(true);
    
    const allCloneItems = clone.querySelectorAll('ol.list-container > li');
    allCloneItems.forEach((item, index) => {
        if (index >= 10) item.style.display = 'none';
    });
    const showMoreClone = clone.querySelector('.show-more-container');
    if (showMoreClone) showMoreClone.style.display = 'none';

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

    const STORY_WIDTH = 720;
    const STORY_HEIGHT = 1280;

    const container = document.createElement("div");
    container.style.width = `${STORY_WIDTH}px`;
    container.style.height = `${STORY_HEIGHT}px`;
    container.style.background = "#121212";
    container.style.color = "#fff";
    container.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    container.style.overflow = 'hidden';
    
    container.style.position = 'fixed'; 
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-9999';

    const contentWrapper = document.createElement("div");
    contentWrapper.style.width = '100%';
    contentWrapper.style.padding = "80px 40px 40px 40px";
    contentWrapper.style.boxSizing = "border-box";
    
    contentWrapper.style.position = 'absolute';
    contentWrapper.style.top = '50%';
    contentWrapper.style.left = '50%';
    contentWrapper.style.transform = 'translate(-50%, -50%)';
    
    const pageHeader = document.querySelector('header');
    const headerClone = pageHeader.cloneNode(true);
    headerClone.style.textAlign = 'center';
    headerClone.style.marginBottom = '1.5rem';
    headerClone.querySelectorAll('.typing-cursor').forEach(c => c.remove());
    
    contentWrapper.appendChild(headerClone);
    contentWrapper.appendChild(clone);

    const styleFix = document.createElement('style');
    styleFix.innerHTML = `
        .list-container li { 
            opacity: 1 !important; 
            animation: none !important; 
        }

        .genre-pills .genre-label {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            align-content: center !important;
            background: #2a2a2a !important;
            border-radius: 10px !important;
            border: 1px solid var(--genre-color, #555);
            color: #FFFFFF !important;
            font-size: 0.6rem !important;
            white-space: nowrap !important;
            height: 18px !important;
            line-height: 1 !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
        }

        #personalify-screenshot .genre-pills .genre-label {
            line-height: 18px !important;
        }

        #personalify-screenshot .genre-pills {
            padding-top: 3px !important;
        }
    `;
    contentWrapper.appendChild(styleFix);

    const footer = document.createElement("div");
    footer.innerHTML = `Personalify © 2025 • Powered by Spotify API`;
    footer.style.paddingTop = "2rem";
    footer.style.textAlign = "center";
    footer.style.fontSize = "0.75rem";
    footer.style.color = "#888";
    footer.style.marginTop = "auto";
    contentWrapper.appendChild(footer);

    container.appendChild(contentWrapper);

    async function renderCanvas() {
        document.body.appendChild(container);

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
            console.error("Generate image failed:", err);
            alert("Failed to create image. Try refresh the page.");
        } finally {
            cleanup();
        }
    }

    function cleanup() {
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
        
        document.body.classList.remove('force-desktop-view');
        document.body.classList.remove('download-mode');
        
        document.body.style.overflow = '';
        document.body.style.touchAction = '';

        void document.body.offsetWidth; 
        
        for (const key in sections) {
            sections[key].style.removeProperty('display');
            sections[key].classList.remove("active");
        }

        if (document.body.contains(loadingOverlay)) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(loadingOverlay)) {
                    document.body.removeChild(loadingOverlay);
                }
            }, 300);
        }

        setTimeout(() => {
            if (genreChartInstance) {
                genreChartInstance.resize();
            }

            checkScreenSize();
            
            if (window.innerWidth <= 768) {
                if(categoryFilterWrapper) categoryFilterWrapper.style.display = "inline-block";
                
                updateCategoryDisplay();
            }
        }, 100); 
    }

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

async function loadEmotionAnalysis(isExtended = false) {
    const emotionElement = document.querySelector('.emotion-recap');
    const currentText = emotionElement.textContent;

    if (currentText.includes("being analyzed") || currentText.includes("getting ready") || isExtended) {
        if (!isExtended) {
            emotionElement.innerHTML = 'Your music vibe is being analyzed... <svg class="dash-spinner-small" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none"></circle></svg>';
        } else {
            emotionElement.innerHTML = 'Analyzing extended music collection... <svg class="dash-spinner-small" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none"></circle></svg>';
        }

        try {
            const urlParts = window.location.pathname.split('/');
            const spotifyId = urlParts[urlParts.length - 1];
            const urlParams = new URLSearchParams(window.location.search);
            const timeRange = urlParams.get('time_range') || 'short_term';
            const response = await fetch('/analyze-emotions-background', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spotify_id: spotifyId,
                    time_range: timeRange,
                    extended: isExtended 
                })
            });

            if (response.status === 401) {
                window.location.href = "/?error=session_expired";
                return;
            }

            const data = await response.json();
            if (data.emotion_paragraph) {
                typeEffect(emotionElement, data.emotion_paragraph);
            } else {
                typeEffect(emotionElement, "Vibe analysis is currently unavailable.");
            }

        } catch (error) {
            console.warn("Could not load emotion analysis:", error);
            typeEffect(emotionElement, "Vibe analysis is currently unavailable.");
        }
    }
}

const style = document.createElement('style');
style.textContent = `
.loading-dots {
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}

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

.embed-list-item {
    list-style: none !important;
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

.loading-dots {
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}


.track-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-grow: 1;
    min-width: 0;
}

.embed-placeholder {
    display: none;
    flex-grow: 1;
    min-width: 0;
    margin-left: -0.5rem;
}

.track-item.embed-shown .track-content {
    display: none;
}

.track-item.embed-shown .embed-placeholder {
    display: block;
    font-size: 0;
    margin-top: -0.2rem;
    margin-bottom: -0.3rem;
}

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
    border-radius: 8px;
}


.embed-placeholder {
    position: relative;
}

.embed-placeholder::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
}

#tracks-section li:hover .embed-placeholder::after {
    opacity: 1;
}


.embed-wrapper {
    position: relative;
    line-height: 0;
}

.embed-close-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 5;
    background-color: rgba(255, 255, 255, 0.25);
    color: #ffffff;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
    pointer-events: none;
}

.list-item.embed-shown:hover .embed-close-btn {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
}

.embed-close-btn:hover {
    background-color: #333;
    transform: scale(1.1);
}

.list-item.embed-shown .rank {
    cursor: pointer;
    color: #1DB954;
    transition: color 0.2s ease, transform 0.2s ease;
}

.list-item.embed-shown .rank:hover {
    color: #ffffff;
    text-shadow: 0 0 8px rgba(29, 185, 84, 0.7);
}

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

@media (hover: none) {
    #tracks-section li:hover,
    #artists-section li:hover,
    #genres-section li:hover {
        background-color: initial;
        transform: none;
        box-shadow: none;
    }

    .list-item.embed-shown .rank:hover {
        color: #1DB954;
        text-shadow: none;
    }

    #tracks-section li:hover .embed-placeholder::after {
        opacity: 0;
    }
}
`;

document.head.appendChild(style);
document.addEventListener('DOMContentLoaded', async function() {
    const titleEl = document.querySelector('header h1');
    const subtitleEl = document.querySelector('header .subtitle');
    const emotionEl = document.querySelector('header .emotion-recap');
    if (!titleEl || !subtitleEl || !emotionEl) {
        console.warn("Elemen header untuk efek ketik tidak ditemukan.");
        setTimeout(() => loadEmotionAnalysis(false), 1000);
        return;
    }
    const originalTitle = titleEl.textContent;
    const originalSubtitle = subtitleEl.textContent;
    const originalEmotion = emotionEl.innerHTML;
    titleEl.textContent = '';
    subtitleEl.textContent = '';
    emotionEl.innerHTML = '';
    await typeEffect(titleEl, originalTitle, 50);
    await typeEffect(subtitleEl, originalSubtitle, 30);
    await typeEffect(emotionEl, originalEmotion, 30);
    const footerEl = document.querySelector('footer');
    if (footerEl) footerEl.classList.add('fade-in');

    setTimeout(() => loadEmotionAnalysis(false), 1000);
});

window.onload = function() {
    Chart.defaults.global.legend.display = false;

    const ctx = document.getElementById('genreChart');
    if (ctx) {
        const chartColors = [
            '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
            '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
            '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
            '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
        ];
        
        window.genreColorMapTop10 = new Map();
        window.genreColorMapTop20 = new Map();
        genreData.labels.forEach((label, index) => {
            window.genreColorMapTop10.set(label, chartColors[index % chartColors.length]);
        });
        genreDataExtended.labels.forEach((label, index) => {
            window.genreColorMapTop20.set(label, chartColors[index % chartColors.length]);
        });
        window.applyGenrePillColors = function(isExtended = false) {
            const colorMap = isExtended ? window.genreColorMapTop20 : window.genreColorMapTop10;
            document.querySelectorAll('.genre-label').forEach(pill => {
                const name = pill.textContent.trim();
                const color = colorMap.get(name) || "#666";
                pill.style.setProperty('--genre-color', color);
            });
        };
        currentGenreData = {
            labels: genreData.labels,
            counts: genreData.counts
        };
        currentGenreArtistsMap = genreArtistsMap;
        const genreColorMap = new Map();
        genreDataExtended.labels.forEach((label, index) => { 
            genreColorMap.set(label, chartColors[index % chartColors.length]);
        });

        applyGenrePillColors(false);

        genreChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: currentGenreData.labels,
                datasets: [{
                    data: currentGenreData.counts,
                    backgroundColor: chartColors.map(c => hexToRgba(c, 0.8)),
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1, 
                    hoverBackgroundColor: chartColors.map(c => hexToRgba(c, 1)),
                    hoverBorderColor: '#ffffff',
                    hoverBorderWidth: 2
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
        genreChartInstance.getDatasetMeta(0).data.forEach((slice, index) => {
            if (index >= 10) {
                slice.hidden = true;
            }
        });
        genreChartInstance.update();
        applyGenrePillColors(false);
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

    let easterEggClicked = false;
    document.querySelectorAll('.footer-toggler').forEach(toggler => {
        toggler.addEventListener('click', function() {
            if (easterEggClicked) return;
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
            applyGenrePillColors(true);
            loadEmotionAnalysis(true);
            easterEggClicked = true;
        });
    });

    const urlParts = window.location.pathname.split('/');
    const spotifyId = urlParts[urlParts.length - 1];
    const urlParams = new URLSearchParams(window.location.search);
    const timeRange = urlParams.get('time_range') || 'short_term';
    fetch(`/top-data?spotify_id=${spotifyId}&time_range=${timeRange}`)
      .then(res => {
          if (res.status === 401) {
              window.location.href = "/?error=session_expired";
              return null; 
          }
          return res.json();
      })
      .then(data => {
      })
      .catch(err => console.error("Error fetching top data:", err));
};

function updateGenreList(labels, counts) {
    const genreList = document.querySelector('#genres-section .list-container');
    if (!genreList) return;

    const chartColors = [
        '#1DB954', '#F28E2B', '#E15759', '#76B7B2', '#9AA067',
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
        '#4D4D4D', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
        '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'
    ];

    const genreColorMapTop10 = new Map();
    const genreColorMapTop20 = new Map();

    genreData.labels.forEach((label, index) => {
        genreColorMapTop10.set(label, chartColors[index % chartColors.length]);
    });

    genreDataExtended.labels.forEach((label, index) => {
        genreColorMapTop20.set(label, chartColors[index % chartColors.length]);
    });

    function applyGenrePillColors(isExtended = false) {
        const mapToUse = isExtended ? genreColorMapTop20 : genreColorMapTop10;
        document.querySelectorAll('.genre-label').forEach(pill => {
            const name = pill.textContent.trim();
            const color = mapToUse.get(name) || "#666";
            pill.style.setProperty('--genre-color', color);
        });
    }

    genreList.innerHTML = labels.map((label, index) => {
        const artists = genreArtistsMapExtended[label] || [];
        const artistText = artists.length > 0 ? `: ${artists.join(', ')}` : '';
        let animStyle = '';
        let animClass = ''; 
        if (index < 10) {
            animClass = 'no-animation';
        } else {
            const delay = (index - 10) * 0.1;
            animStyle = `animation-delay: ${delay}s;`;
        }
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
    const providerLink = document.getElementById('provider-link');
    const providerData = [
        { text: 'Spotify API', url: 'https://developer.spotify.com/', type: 'spotify' },
        { text: 'Hugging Face', url: 'https://huggingface.co/', type: 'huggingface' }
    ];
    let typeLoop = 0;
    let isDeleting = false;
    let txt = '';
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
            updateProviderStyle(i);
        } else if (isDeleting && txt === '') {
            isDeleting = false;
            typeLoop++;
            delta = 500;
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

    if(providerLink) typeWriter();
    const downloadBtn = document.querySelector('.download-btn');
    const modalButtons = document.querySelectorAll('.modal-options button');
    const listItems = document.querySelectorAll('.list-container li');
    const dropdownTriggers = document.querySelectorAll('.select-trigger');
    const dropdownOptions = document.querySelectorAll('.custom-option');
    const elementsToGlow = [downloadBtn, ...modalButtons, ...listItems, ...dropdownTriggers, ...dropdownOptions];
    elementsToGlow.forEach(el => {
        if (el) {
            el.addEventListener('mousemove', (e) => updateGlow(e, el));
            el.addEventListener('mouseleave', () => {
            });     
            el.addEventListener('touchstart', (e) => updateGlow(e, el));
            el.addEventListener('touchmove', (e) => updateGlow(e, el));
            el.addEventListener('touchend', () => {
            });
        }
    });
    
    const footerEl = document.querySelector('footer');
    const container = document.getElementById('dashboard');
    if (!footerEl || !downloadBtn) return;
    const observer = new IntersectionObserver((entries) => {
        if (window.innerWidth > 768) {
            downloadBtn.classList.remove('hide-on-scroll');
            if (container) container.classList.remove('footer-visible');
            return;
        }

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                downloadBtn.classList.add('hide-on-scroll');
                if (container) container.classList.add('footer-visible');
            } else {
                downloadBtn.classList.remove('hide-on-scroll');
                if (container) container.classList.remove('footer-visible');
            }
        });
    }, {
        root: null,
        threshold: 0.1
    });
    observer.observe(footerEl);
});

function setupMarquee() {
    document.querySelectorAll('.scroll-active').forEach(el => {
        el.classList.remove('scroll-active');
        el.style.removeProperty('--scroll-distance');
        el.style.removeProperty('--scroll-duration');
        if (el.parentElement.classList.contains('mask-active')) {
            el.parentElement.classList.remove('mask-active');
        }
    });

    const titles = document.querySelectorAll('#artists-section .info .name, #tracks-section .info .name');
    const trackMetas = document.querySelectorAll('#tracks-section .info .meta');
    const albumMetas = Array.from(trackMetas).filter(el => {
        const text = el.textContent.trim();
        return text.startsWith("Album:") || 
               text.startsWith("EP:") || 
               text.startsWith("Maxi-Single:");
    });

    const allowedElements = [...titles, ...albumMetas];
    document.fonts.ready.then(() => {
        allowedElements.forEach(el => {
            const scrollWidth = Math.ceil(el.scrollWidth);
            const clientWidth = Math.ceil(el.clientWidth);
            if (scrollWidth > clientWidth) {
                const distance = scrollWidth - clientWidth + 20;
                const duration = Math.max(distance / 25, 6);   
                el.style.setProperty('--scroll-distance', `-${distance}px`);
                el.style.setProperty('--scroll-duration', `${duration}s`);
                el.classList.add('scroll-active');
                el.parentElement.classList.add('mask-active');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', setupMarquee);
window.addEventListener('load', setupMarquee);
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