"use client";

import React, { useRef, useEffect, useState } from "react";

interface MarqueeTextProps {
    text: string;
    className?: string; // Additional classes for the container or text
}

const MarqueeText = ({ text, className = "" }: MarqueeTextProps) => {
    const textRef = useRef<HTMLParagraphElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const checkOverflow = () => {
            const el = textRef.current;
            if (!el) return;

            const scrollWidth = Math.ceil(el.scrollWidth);
            const clientWidth = Math.ceil(el.clientWidth);

            // Added a 2px tolerance to prevent false-positives
            if (scrollWidth > clientWidth + 2) {
                const distance = scrollWidth - clientWidth + 24; // 24px buffer for the loop
                const duration = Math.max(distance / 25, 6);
                el.style.setProperty('--scroll-distance', `-${distance}px`);
                el.style.setProperty('--scroll-duration', `${duration}s`);
                setIsOverflowing(true);
            } else {
                el.style.removeProperty('--scroll-distance');
                el.style.removeProperty('--scroll-duration');
                setIsOverflowing(false);
            }
        };

        // Delay slightly ensuring layout is ready
        const timeoutId = setTimeout(checkOverflow, 100);
        window.addEventListener('resize', checkOverflow);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', checkOverflow);
        };
    }, [text]);

    return (
        <div className={`min-w-0 flex-1 overflow-hidden pb-1 -mb-1 ${isOverflowing ? "mask-active" : ""}`}>
            <p
                ref={textRef}
                className={`${className} overflow-visible ${isOverflowing ? "scroll-active" : "truncate"}`}
            >
                {text}
            </p>
        </div>
    );
};

export default MarqueeText;
