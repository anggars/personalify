document.addEventListener("DOMContentLoaded", () => {
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
                const mainTitle = document.querySelector('h1'); 
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
                }
                document.body.classList.add('toast-active'); 
                toast.style.animation = 'none';
                toast.offsetHeight; 
                toast.textContent = message;
                toast.style.display = 'block';
                toast.style.animation = 'slideDownFade 0.5s ease-out forwards';
                toastTimer = setTimeout(() => {
                    toast.style.animation = 'fadeOut 0.5s ease-out forwards';
                    if (mainTitle) mainTitle.style.opacity = '1'; 
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
});