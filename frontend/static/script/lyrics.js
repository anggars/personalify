const form = document.getElementById('lyricsForm');
const lyricsInput = document.getElementById('lyricsInput');
const resultDiv = document.getElementById('resultOutput');
const resultsSection = document.getElementById('results-section');
const analyzeButton = document.getElementById('analyzeButton');
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const getSpinnerHtml = (text) => `
    <div class="loading-state-container">
        <svg class="spinner" viewBox="0 0 50 50">
            <circle class="path" cx="25" cy="25" r="20" fill="none"></circle>
        </svg>
        <span>${text}</span>
    </div>
`;

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

async function analyzeLyrics() {
    const lyrics = lyricsInput.value;

    if (!lyrics || lyrics.trim() === '') {
        resultsSection.style.display = 'block';

        resultDiv.innerHTML = `<p class="status-msg error">Please paste some lyrics first!</p>`;
        return; 

    }

    resultsSection.style.display = 'block';

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
                    <span class="emotion-score">${(e.score * 100).toFixed(1)}%</span>
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

form.addEventListener('submit', function(e) {
    e.preventDefault();
    analyzeLyrics();
});

lyricsInput.addEventListener('keydown', function(event) {

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

document.addEventListener('DOMContentLoaded', async function() {
    const titleEl = document.querySelector('header h1');
    const subtitleEl = document.querySelector('header p.subtitle');
    const containerEl = document.querySelector('.container');
    const footerEl = document.querySelector('footer');
    const analyzeButton = document.querySelector('.lyrics-form .button-primary');

    if (analyzeButton) {

        analyzeButton.addEventListener('mousemove', (e) => updateGlow(e, analyzeButton));
        analyzeButton.addEventListener('mouseleave', () => {
        });

        analyzeButton.addEventListener('touchstart', (e) => updateGlow(e, analyzeButton));
        analyzeButton.addEventListener('touchmove', (e) => updateGlow(e, analyzeButton));
        analyzeButton.addEventListener('touchend', () => {
        });
    }

    if (titleEl && subtitleEl && containerEl) {
        const titleText = titleEl.textContent;
        const subtitleHtml = subtitleEl.innerHTML;

        const sectionEl = containerEl.querySelector('.section');
        if (sectionEl) {
            sectionEl.style.opacity = '0';
            sectionEl.style.animation = 'none'; 
        }

        titleEl.innerHTML = '';
        subtitleEl.innerHTML = '';
        titleEl.style.visibility = 'visible';
        subtitleEl.style.visibility = 'visible';

        containerEl.style.visibility = 'visible';

        await typeEffect(titleEl, titleText, 50);

        await typeEffect(subtitleEl, subtitleHtml, 30);

        if (sectionEl) {
            sectionEl.style.animation = 'fadeInUp 1s ease-out forwards';
        }
    }

    if (footerEl) footerEl.classList.add('fade-in');

    const dynamicLinkBottom = document.getElementById('dynamic-footer-link');

    if (dynamicLinkBottom) {
        let isAboutState = true; 

        setInterval(() => {

            dynamicLinkBottom.classList.add('fading-out');

            setTimeout(() => {
                if (isAboutState) {

                    dynamicLinkBottom.innerHTML = 'Created by <a href="https://desty.page/anggars" target="_blank" class="footer-link">アリツ</a>';
                } else {

                    dynamicLinkBottom.innerHTML = '<a href="/about" class="footer-link">About & Credits</a>';
                }

                isAboutState = !isAboutState;

                dynamicLinkBottom.classList.remove('fading-out');
            }, 500); 

        }, 5000); 

    }   
});

document.addEventListener('DOMContentLoaded', () => {
    const lyricsInput = document.getElementById('lyricsInput'); 

    if (lyricsInput) {
        lyricsInput.addEventListener('paste', (e) => {

            e.preventDefault();

            const clipboardText = (e.clipboardData || window.clipboardData).getData('text');

            const cleanText = clipboardText
                .split(/\r?\n/)             
                .map(line => line.trim())   
                .filter(line => line !== '') 
                .join('\n');                
            document.execCommand('insertText', false, cleanText);
        });
    }
});