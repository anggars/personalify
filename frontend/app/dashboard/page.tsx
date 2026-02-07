"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
    const router = useRouter();
    const [animatedDots, setAnimatedDots] = useState(".");

    const showToast = (message: string, type: "success" | "error") => {
        const event = new CustomEvent("personalify-notification", {
            detail: { type, message },
        });
        window.dispatchEvent(event);
        setTimeout(() => {
            window.dispatchEvent(
                new CustomEvent("personalify-notification", { detail: null }),
            );
        }, 3000);
    };

    useEffect(() => {
        const dotsInterval = setInterval(() => {
            setAnimatedDots((prev) => (prev.length >= 3 ? "." : prev + "."));
        }, 400);
        return () => clearInterval(dotsInterval);
    }, []);

    useEffect(() => {
        const checkSession = async () => {
            // 1. Check LocalStorage first
            const storedId = localStorage.getItem("spotify_id");
            if (storedId) {
                router.replace(`/dashboard/${storedId}?time_range=short_term`);
                return;
            }

            // 2. Fallback to API check (incase localStorage cleared but cookies exist)
            try {
                const res = await fetch("/api/me", { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (data.spotify_id) {
                        localStorage.setItem("spotify_id", data.spotify_id);
                        router.replace(`/dashboard/${data.spotify_id}?time_range=short_term`);
                        return;
                    }
                }
            } catch (err) {
                console.error("Session check failed:", err);
            }

            // 3. Not logged in -> Redirect Home
            showToast("Please login with Spotify first!", "error");
            router.replace("/");
        };

        checkSession();
    }, [router]);

    return (
        <div className="page-container flex-1 flex flex-col items-center justify-center min-h-[calc(100dvh-160px)] w-full">
            <svg className="w-8 h-8 mb-4 spinner-svg" viewBox="0 0 50 50">
                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" />
            </svg>
            <span className="font-semibold text-foreground">
                Loading Dashboard{animatedDots}
            </span>
        </div>
    );
}
