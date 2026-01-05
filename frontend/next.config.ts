import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image domains
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  // API Rewrites to backend
  async rewrites() {
    return [
      // Genius API endpoints
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      // NLP endpoint
      {
        source: "/analyze-lyrics",
        destination: "http://127.0.0.1:8000/analyze-lyrics",
      },
      // Emotion analysis background
      {
        source: "/analyze-emotions-background",
        destination: "http://127.0.0.1:8000/analyze-emotions-background",
      },
      // Auth endpoints
      {
        source: "/login",
        destination: "http://127.0.0.1:8000/login",
      },
      {
        source: "/callback",
        destination: "http://127.0.0.1:8000/callback",
      },
      {
        source: "/logout",
        destination: "http://127.0.0.1:8000/logout",
      },
    ];
  },
};

export default nextConfig;
