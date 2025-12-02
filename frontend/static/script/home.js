/**
 * FUNGSI: Efek Ketik (Typing Effect)
 */
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

document.addEventListener('DOMContentLoaded', async function() {
    // === 1. HERO ANIMATION ===
    const titleEl = document.querySelector('.hero h1');
    const pEl = document.querySelector('.hero p');
    const buttonEl = document.querySelector('.hero .button');
    const footerEl = document.querySelector('footer');

    if (titleEl && pEl && buttonEl) {
        const pText = pEl.innerHTML;
        pEl.innerHTML = ''; 

        setTimeout(() => {
            titleEl.classList.add('visible');
            buttonEl.classList.add('visible');
            if (footerEl) footerEl.classList.add('visible');

            setTimeout(async () => {
                await typeEffect(pEl, pText, 20);
            }, 1000);
        }, 500); 
        
        // Listener Tombol (Loading Effect)
        buttonEl.addEventListener('click', function(event) {
            event.preventDefault(); 
            this.classList.add('loading');
            const destinationUrl = this.href;
            setTimeout(() => {
                window.location.href = destinationUrl;
            }, 1000); 
        });
    }

    // === 2. DYNAMIC FOOTER (About <-> Aritsu) ===
    // Bagian atas statis (Spotify), bagian bawah dinamis
    const dynamicLinkBottom = document.getElementById('dynamic-footer-link');
    
    if (dynamicLinkBottom) {
        let isAboutState = true; 

        setInterval(() => {
            // 1. Fade Out
            dynamicLinkBottom.classList.add('fading-out');

            // 2. Tunggu 500ms, ganti konten
            setTimeout(() => {
                if (isAboutState) {
                    // Ganti ke: Created by Aritsu
                    dynamicLinkBottom.innerHTML = 'Created by <a href="https://desty.page/anggars" target="_blank" class="footer-link">アリツ</a>';
                } else {
                    // Balik ke: About & Credits
                    dynamicLinkBottom.innerHTML = '<a href="/about" class="footer-link">About & Credits</a>';
                }
                
                isAboutState = !isAboutState;

                // 3. Fade In
                dynamicLinkBottom.classList.remove('fading-out');
            }, 500); 

        }, 5000); 
    }
});

// --- NEW: CURSOR FOLLOW GLOW LOGIC ---
document.addEventListener('DOMContentLoaded', function() {
    const buttonEl = document.querySelector('.hero .button');

    if (buttonEl) {
        // [LOGIC MOUSE LAMA TETAP ADA]
        buttonEl.addEventListener('mousemove', (e) => updateGlow(e, buttonEl));
        buttonEl.addEventListener('mouseleave', () => {
        });
        // [BARU: TOUCH EVENTS]
        buttonEl.addEventListener('touchstart', (e) => updateGlow(e, buttonEl));
        buttonEl.addEventListener('touchmove', (e) => updateGlow(e, buttonEl));
        buttonEl.addEventListener('touchend', () => {
        });
    }
});

// Reset tombol loading saat user kembali (Back button)
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const buttonEl = document.querySelector('.hero .button');
        if (buttonEl) {
            buttonEl.classList.remove('loading');
        }
    }
});