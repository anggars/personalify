document.addEventListener("DOMContentLoaded", () => {
    function updateGlow(e, el) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        if (clientX === undefined) return;
        const rect = el.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width * 100;
        const y = (clientY - rect.top) / el.clientHeight * 100;
        el.style.setProperty('--mouse-x', `${x}%`);
        el.style.setProperty('--mouse-y', `${y}%`);
    }
    const logoutLink = document.querySelector('a[href="/logout"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', function() {
            localStorage.removeItem("spotify_id");
        });
    }
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam === 'logged_out' || errorParam === 'session_expired') {
        localStorage.removeItem("spotify_id");
    }
    const currentPath = window.location.pathname.replace(/\/+$/, "");
    const navLinks = document.querySelectorAll(".nav-item a");
    let isAnyActive = false;
    navLinks.forEach((link) => {
        const rawHref = link.getAttribute("href");
        if (!rawHref || rawHref === "#") return;
        const cleanHref = rawHref.replace(/\/+$/, "");
        if (cleanHref === currentPath && currentPath !== "") {
            link.classList.add("active");
            isAnyActive = true;
            const parentItem = link.closest('.nav-item');
            if (parentItem) parentItem.classList.add('active');
        }
    });
    if (!isAnyActive && currentPath.includes('/dashboard')) {
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => {
            if (item.innerText.includes('Dashboard')) item.classList.add('active');
        });
    }
    if (window.location.pathname.includes('/dashboard/')) {
        const pathParts = window.location.pathname.split('/');
        const dashboardIndex = pathParts.indexOf('dashboard');
        if (dashboardIndex !== -1 && pathParts[dashboardIndex + 1]) {
            const currentSpotifyId = pathParts[dashboardIndex + 1];
            localStorage.setItem("spotify_id", currentSpotifyId);
        }
    }
    const storedSpotifyId = localStorage.getItem("spotify_id");
    const loginLink = document.querySelector('a[href="/login"]');
    if (loginLink) {
        if (storedSpotifyId && !errorParam) {
            loginLink.href = `/dashboard/${storedSpotifyId}?time_range=short_term`;
            loginLink.textContent = "Dashboard";
            loginLink.classList.add('user-logged-in');
        } else {
            loginLink.href = "#";
            loginLink.title = "Please login using the 'Login with Spotify' button on the home page!";
            loginLink.textContent = "Dashboard";
            loginLink.classList.remove('user-logged-in');
            let toastTimer;
            let fadeOutTimer;
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("⚠️ Please login using the button on the home page!");
            });
            function showToast(message) {
                const activeBubbles = document.querySelectorAll('.video-bubble-toast.show');
                activeBubbles.forEach(bubble => {
                    bubble.classList.remove('show');
                });
                let toast = document.getElementById('error-toast');
                const mainTitle = document.querySelector('header h1');
                if (toastTimer) clearTimeout(toastTimer);
                if (fadeOutTimer) clearTimeout(fadeOutTimer);
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'error-toast';
                    document.body.appendChild(toast);
                }
                if (mainTitle) {
                    mainTitle.style.transition = 'opacity 0.2s ease';
                    mainTitle.style.opacity = '0';
                    mainTitle.style.visibility = 'hidden';
                }
                document.body.classList.add('toast-active');
                toast.style.animation = 'none';
                toast.offsetHeight;
                toast.textContent = message;
                toast.style.display = 'block';
                toast.style.animation = 'slideDownFade 0.5s ease-out forwards';
                toastTimer = setTimeout(() => {
                    toast.style.animation = 'fadeOut 0.5s ease-out forwards';
                    if (mainTitle) {
                        mainTitle.style.opacity = '1';
                        mainTitle.style.visibility = 'visible';
                    }
                    document.body.classList.remove('toast-active');
                    fadeOutTimer = setTimeout(() => {
                        toast.style.display = 'none';
                    }, 500);
                }, 3000);
            }
        }
    }
    if (window.location.pathname === '/login' && storedSpotifyId && !errorParam) {
        window.location.href = `/dashboard/${storedSpotifyId}?time_range=short_term`;
    }
    const dropdowns = document.querySelectorAll('.nav-item.dropdown');
    dropdowns.forEach((dropdown) => {
        const originalContent = dropdown.querySelector('.dropdown-content');
        const triggerLink = dropdown.querySelector('a'); 
        if (!originalContent) return;
        const portalContent = document.createElement('div');
        portalContent.className = originalContent.className;
        portalContent.style.cssText = originalContent.style.cssText;
        portalContent.style.display = 'none';
        portalContent.style.position = 'fixed';
        portalContent.style.zIndex = '10000';
        portalContent.innerHTML = originalContent.innerHTML;
        document.body.appendChild(portalContent);
        originalContent.remove();
        const portalLinks = portalContent.querySelectorAll('a');
        portalLinks.forEach(link => {
            link.addEventListener('mousemove', (e) => updateGlow(e, link));
            link.addEventListener('touchstart', (e) => updateGlow(e, link));
            link.addEventListener('touchmove', (e) => updateGlow(e, link));
        });
        let isHovered = false;
        let closeTimeout = null;
        function updatePosition() {
            const rect = dropdown.getBoundingClientRect();
            portalContent.style.left = (rect.left + rect.width / 2) + 'px';
            portalContent.style.top = (rect.bottom - 1) + 'px'; 
            portalContent.style.transform = 'translateX(-50%)';
        }
        const showDropdown = () => {
            isHovered = true;
            if (closeTimeout) clearTimeout(closeTimeout);
            portalContent.style.display = 'flex';
            updatePosition();
            portalContent.classList.remove('dropdown-animate-out');
            portalContent.classList.add('dropdown-animate-in');
        };
        const hideDropdown = () => {
            isHovered = false;
            closeTimeout = setTimeout(() => {
                if (!isHovered) {
                    portalContent.classList.remove('dropdown-animate-in');
                    portalContent.classList.add('dropdown-animate-out');
                    setTimeout(() => {
                        if (!isHovered) {
                            portalContent.style.display = 'none';
                            portalContent.classList.remove('dropdown-animate-out');
                        }
                    }, 280);
                }
            }, 100);
        };
        dropdown.addEventListener('mouseenter', () => {
            if (window.innerWidth > 768) { 
                showDropdown();
            }
        });
        dropdown.addEventListener('mouseleave', hideDropdown);
        portalContent.addEventListener('mouseenter', () => {
            isHovered = true;
            if (closeTimeout) clearTimeout(closeTimeout);
        });
        portalContent.addEventListener('mouseleave', hideDropdown);
        if (triggerLink) {
            triggerLink.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    if (portalContent.style.display === 'none') {
                        e.preventDefault(); 
                        e.stopPropagation();
                        showDropdown();
                    }
                }
            });
        }
        window.addEventListener('resize', () => {
            if (portalContent.style.display !== 'none') {
                updatePosition();
            }
        });
    });
});