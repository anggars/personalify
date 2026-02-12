import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image domains
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  // API Rewrites to backend
  async rewrites() {
    const isProduction = process.env.NODE_ENV === "production";
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ||
      (isProduction ? "" : "http://127.0.0.1:8000");

    console.log(
      `[NextConfig] Using BACKEND_URL for rewrites: ${BACKEND_URL || "SAME_DOMAIN"}`,
    );

    // If in production and no API_URL provided, we rely on vercel.json or same-domain routing
    // BUT we still need to return the list of rewrites. 
    // If BACKEND_URL is "", the destination becomes "/api/:path*" which is an internal rewrite.
    
    return [
      // Resume hidden link
      {
        source: "/resume",
        destination: "/resume.html",
      },
      // Genius API endpoints
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // NLP endpoint
      {
        source: "/analyze-lyrics",
        destination: `${BACKEND_URL}/analyze-lyrics`,
      },
      // Sentiment analysis background
      {
        source: "/analyze-sentiment-background",
        destination: `${BACKEND_URL}/analyze-sentiment-background`,
      },
      // Auth endpoints
      {
        source: "/login",
        destination: `${BACKEND_URL}/login`,
      },
      {
        source: "/callback",
        destination: `${BACKEND_URL}/callback`,
      },
      {
        source: "/logout",
        destination: `${BACKEND_URL}/logout`,
      },
      // Admin endpoints (Direct /admin/ paths)
      {
        source: "/admin/stats",
        destination: `${BACKEND_URL}/admin/stats`,
      },
      {
        source: "/admin/clear",
        destination: `${BACKEND_URL}/admin/clear`,
      },
      {
        source: "/admin/sync",
        destination: `${BACKEND_URL}/admin/sync`,
      },
      {
        source: "/admin/export",
        destination: `${BACKEND_URL}/admin/export`,
      },
      {
        source: "/admin/report/:path*",
        destination: `${BACKEND_URL}/admin/report/:path*`,
      },
      // Request Access
      {
        source: "/request-access",
        destination: `${BACKEND_URL}/request-access`,
      },
    ];
  },
};

export default nextConfig;
