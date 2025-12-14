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
            loginLink.href = "/login";
            loginLink.textContent = "Dashboard"; 
            loginLink.classList.remove('user-logged-in');
        }
    }
    if (window.location.pathname === '/login' && storedSpotifyId && !errorParam) {
        window.location.href = `/dashboard/${storedSpotifyId}?time_range=short_term`;
    }
});