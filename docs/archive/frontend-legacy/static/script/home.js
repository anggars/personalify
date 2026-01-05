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
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined) return; 
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * 100;
    const y = (clientY - rect.top) / el.clientHeight * 100; 
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
};
document.addEventListener('DOMContentLoaded', async function() {
    const logoEl = document.querySelector('.logo'); 
    const titleEl = document.querySelector('.hero h1');
    const pEl = document.querySelector('.hero p');
    const buttonEl = document.querySelector('.hero .button');
    const footerEl = document.querySelector('footer');
    if (titleEl && pEl && buttonEl) {
        const pText = pEl.innerHTML;
        pEl.innerHTML = ''; 
        setTimeout(() => {
            if (logoEl) logoEl.classList.add('visible');
            titleEl.classList.add('visible');
            buttonEl.classList.add('visible');
            if (footerEl) footerEl.classList.add('visible');
            setTimeout(async () => {
                await typeEffect(pEl, pText, 20);
            }, 1000);
        }, 100);
    }
    if (buttonEl) {
        buttonEl.addEventListener('click', function(e) {
            e.preventDefault();
            this.classList.add('loading');
            const destinationUrl = this.getAttribute('href');
            setTimeout(() => {
                window.location.href = destinationUrl;
            }, 1000);
        });
    }
});
document.addEventListener('DOMContentLoaded', function() {
    const buttonEl = document.querySelector('.hero .button');
    if (buttonEl) {
        buttonEl.addEventListener('mousemove', (e) => updateGlow(e, buttonEl));
        buttonEl.addEventListener('mouseleave', () => {
        });
        buttonEl.addEventListener('touchstart', (e) => updateGlow(e, buttonEl));
        buttonEl.addEventListener('touchmove', (e) => updateGlow(e, buttonEl));
        buttonEl.addEventListener('touchend', () => {
        });
    }
    const errorToast = document.getElementById('error-toast');
    if (errorToast) {
        errorToast.addEventListener('mousemove', (e) => updateGlow(e, errorToast));
        errorToast.addEventListener('mouseleave', () => {
        });
        errorToast.addEventListener('touchstart', (e) => updateGlow(e, errorToast));
        errorToast.addEventListener('touchmove', (e) => updateGlow(e, errorToast));
        errorToast.addEventListener('touchend', () => {
        });
    }
});
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const buttonEl = document.querySelector('.hero .button');
        if (buttonEl) {
            buttonEl.classList.remove('loading');
        }
    }
});