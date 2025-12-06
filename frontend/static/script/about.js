document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('keydown', function(e) {
    // Cek tombol Ctrl atau Command (buat jaga-jaga)
    if ((e.ctrlKey || e.metaKey) && 
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_')) {
        e.preventDefault();
    }
});

function typeEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        let index = 0;
        let currentHtml = '';
        
        function typeWriter() {
            if (index < text.length) {
                let char = text.charAt(index);
                if (char === '<') {
                    let tagEnd = text.indexOf('>', index);
                    if (tagEnd !== -1) {
                        currentHtml += text.substring(index, tagEnd + 1);
                        index = tagEnd + 1;
                    } else {
                        currentHtml += char; index++;
                    }
                } else {
                    currentHtml += char; index++;
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
    const titleEl = document.querySelector('header.hero h1');
    const subtitleEl = document.querySelector('header.hero p');
    const containerEl = document.querySelector('.container');
    const footerEl = document.querySelector('footer');

    // =========================================
    // 1. EASTER EGG LOGIC (Audio & Bubbles)
    // =========================================
    
    // Elemen Link
    const tuningLink = document.getElementById('tuning-link');
    const mathRockLink = document.getElementById('math-rock-link');
    const midwestEmoLink = document.getElementById('midwest-emo-link');
    
    // Elemen Audio
    const tuningSound = document.getElementById('tuning-sound');
    const mathRockSound = document.getElementById('math-rock-sound');
    const midwestEmoSound = document.getElementById('midwest-emo-sound');
    const allSounds = [tuningSound, mathRockSound, midwestEmoSound];

    // Elemen Bubble
    const allBubbles = document.querySelectorAll('.video-bubble-toast');
    const videoBubble = document.getElementById('video-bubble');
    const mathRockBubble = document.getElementById('math-rock-bubble');
    const midwestEmoBubble = document.getElementById('midwest-emo-bubble');

    let activeBubbleTimer = null;

    function playSound(soundToPlay) {
        allSounds.forEach(sound => {
            if (sound !== soundToPlay && !sound.paused) {
                sound.pause();
                sound.currentTime = 0;
            }
        });
        if (!soundToPlay.paused) {
            soundToPlay.pause();
            soundToPlay.currentTime = 0;
        }
        soundToPlay.play();
    }

    function showBubble(bubbleToShow) {
        if (activeBubbleTimer) clearTimeout(activeBubbleTimer);

        allBubbles.forEach(bubble => {
            if (bubble !== bubbleToShow) {
                bubble.classList.remove('show');
            }
        });
        
        let bubbleDuration = 10000;
        
        // Reset animasi marquee khusus video bubble
        if (bubbleToShow.id === 'video-bubble') {
            const marqueeWrapper = bubbleToShow.querySelector('.marquee-content');
            if (marqueeWrapper) {
                const marqueeDurationSeconds = 4; 
                bubbleDuration = marqueeDurationSeconds * 1000; 
                marqueeWrapper.style.animation = 'none';
                void marqueeWrapper.offsetWidth; 
                marqueeWrapper.style.animation = `marquee ${marqueeDurationSeconds}s linear infinite`;
            }
        }
        
        bubbleToShow.classList.add('show');
        
        activeBubbleTimer = setTimeout(() => {
            bubbleToShow.classList.remove('show');
        }, bubbleDuration);
    }

    // Event Listeners
    if (tuningLink && tuningSound && videoBubble) {
        tuningLink.addEventListener('click', function(event) {
            event.preventDefault();
            playSound(tuningSound);
            showBubble(videoBubble);
        });
    }
    if (mathRockLink && mathRockSound && mathRockBubble) {
        mathRockLink.addEventListener('click', function(event) {
            event.preventDefault();
            playSound(mathRockSound);
            showBubble(mathRockBubble);
        });
    }
    if (midwestEmoLink && midwestEmoSound && midwestEmoBubble) {
        midwestEmoLink.addEventListener('click', function(event) {
            event.preventDefault();
            playSound(midwestEmoSound);
            showBubble(midwestEmoBubble);
        });
    }

    // =========================================
    // 2. HEADER ANIMATION
    // =========================================
    if (titleEl && subtitleEl && containerEl) {
        const titleText = titleEl.textContent;
        const subtitleText = subtitleEl.textContent;
        titleEl.innerHTML = '';
        subtitleEl.innerHTML = '';

        titleEl.classList.add('visible');
        subtitleEl.classList.add('visible');
        
        await typeEffect(titleEl, titleText, 50);
        await typeEffect(subtitleEl, subtitleText, 30);
        
        containerEl.style.visibility = 'visible';
        containerEl.style.opacity = '0';
        containerEl.style.animation = 'fadeInUp 1s ease-out forwards';

        if (footerEl) footerEl.classList.add('fade-in');
    }

    // =========================================
    // 3. DYNAMIC FOOTER (TECH STACK)
    // =========================================
    const techPrefix = document.getElementById('tech-prefix');
    const techLink = document.getElementById('tech-link');

    const techStack = [
        { phrase: "Containerized by", name: "Docker", url: "https://www.docker.com/", class: "tech-docker" },
        { phrase: "Built with", name: "Python (FastAPI)", url: "https://fastapi.tiangolo.com/", class: "tech-fastapi" },
        { phrase: "Deployed on", name: "Vercel", url: "https://vercel.com/", class: "tech-vercel" },
        { phrase: "Main Database by", name: "Neon", url: "https://neon.tech/", class: "tech-neon" },
        { phrase: "History stored in", name: "MongoDB Atlas", url: "https://www.mongodb.com/atlas", class: "tech-mongo" },
        { phrase: "Cached by", name: "Upstash", url: "https://upstash.com/", class: "tech-upstash" },
        { phrase: "Lyrics proxy on", name: "Cloudflare", url: "https://workers.cloudflare.com/", class: "tech-cloudflare" },
    ];

    let techLoop = 0;
    let isDeleting = false;
    let currentPhrase = '';
    let currentName = '';
    const typeSpeed = 80; 
    const deleteSpeed = 40; 
    const pauseTime = 2000; 

    function typeTechFooter() {
        if (!techPrefix || !techLink) return;

        const i = techLoop % techStack.length;
        const fullPhrase = techStack[i].phrase;
        const fullName = techStack[i].name;
        const currentData = techStack[i];

        if (isDeleting) {
            if (currentName.length > 0) {
                currentName = fullName.substring(0, currentName.length - 1);
            } else {
                currentPhrase = fullPhrase.substring(0, currentPhrase.length - 1);
            }
        } else {
            if (currentPhrase.length < fullPhrase.length) {
                currentPhrase = fullPhrase.substring(0, currentPhrase.length + 1);
            } else {
                currentName = fullName.substring(0, currentName.length + 1);
            }
        }

        techPrefix.textContent = currentPhrase;
        techLink.textContent = currentName;

        let delta = isDeleting ? deleteSpeed : typeSpeed;

        if (!isDeleting && currentPhrase === fullPhrase && currentName === fullName) {
            delta = pauseTime;
            isDeleting = true;
            techLink.href = currentData.url;
            techLink.className = 'footer-link'; 
            techLink.classList.add(currentData.class);
        } else if (isDeleting && currentPhrase === '' && currentName === '') {
            isDeleting = false;
            techLoop++;
            delta = 500;
        }

        setTimeout(typeTechFooter, delta);
    }

    // =========================================
    // 4. CURSOR FOLLOW GLOW LOGIC (Bubbles)
    // =========================================
        
    allBubbles.forEach(bubble => {
        // [LOGIC MOUSE LAMA TETAP ADA]
        bubble.addEventListener('mousemove', (e) => updateGlow(e, bubble));
        bubble.addEventListener('mouseleave', () => {
        });
        // [BARU: TOUCH EVENTS]
        bubble.addEventListener('touchstart', (e) => updateGlow(e, bubble));
        bubble.addEventListener('touchmove', (e) => updateGlow(e, bubble));
        bubble.addEventListener('touchend', () => {
        });
    });
    typeTechFooter();
});