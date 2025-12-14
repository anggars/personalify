document.addEventListener("DOMContentLoaded", () => {
    // 1. FAILSAFE: HAPUS SESSION JIKA TOMBOL LOGOUT DIKLIK
    // Cari link logout (ada di dalam dropdown saat user login)
    const logoutLink = document.querySelector('a[href="/logout"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', function() {
            localStorage.removeItem("spotify_id"); // Hapus instan
        });
    }

    // 2. DETEKSI URL PARAMETER (Back-up jika user terlempar ke Home)
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam === 'logged_out' || errorParam === 'session_expired') {
        localStorage.removeItem("spotify_id");
    }

    // 3. LOGIC ACTIVE CLASS (Code lama kamu, tidak berubah)
    const currentPath = window.location.pathname.replace(/\/+$/, "");
    const navLinks = document.querySelectorAll(".nav-item a");
    let isAnyActive = false;

    navLinks.forEach((link) => {
        const rawHref = link.getAttribute("href");
        if (!rawHref || rawHref === "#") return;
        const cleanHref = rawHref.replace(/\/+$/, "");

        if (cleanHref === currentPath) {
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

    // 4. SIMPAN ID BARU (Hanya jika kita BENAR-BENAR ada di halaman dashboard)
    if (window.location.pathname.includes('/dashboard/')) {
        const pathParts = window.location.pathname.split('/');
        const dashboardIndex = pathParts.indexOf('dashboard');
        
        if (dashboardIndex !== -1 && pathParts[dashboardIndex + 1]) {
            const currentSpotifyId = pathParts[dashboardIndex + 1];
            localStorage.setItem("spotify_id", currentSpotifyId);
        }
    }

    // 5. RENDER TOMBOL LOGIN / DASHBOARD (Bagian Krusial)
    // Ambil ID dari storage SETELAH proses pembersihan di atas selesai
    const storedSpotifyId = localStorage.getItem("spotify_id"); 
    const loginLink = document.querySelector('a[href="/login"]'); 

    if (loginLink) {
        if (storedSpotifyId && !errorParam) { 
            // Cek !errorParam untuk memastikan kita tidak merubah link jika baru saja logout
            // Ubah link Login jadi Dashboard
            loginLink.href = `/dashboard/${storedSpotifyId}?time_range=short_term`;
            loginLink.textContent = "Dashboard";
            loginLink.classList.add('user-logged-in');
        } else {
            // Pastikan tetap link login
            loginLink.href = "/login";
            loginLink.textContent = "Dashboard"; // Text asli di HTML mungkin 'Dashboard', kita paksa jadi Login jika logout
            loginLink.classList.remove('user-logged-in');
        }
    }

    // 6. PROTEKSI LOGIN PAGE
    if (window.location.pathname === '/login' && storedSpotifyId && !errorParam) {
        window.location.href = `/dashboard/${storedSpotifyId}?time_range=short_term`;
    }
});