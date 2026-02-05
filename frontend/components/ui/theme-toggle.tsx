"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="group relative p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all cursor-pointer overflow-hidden"
      aria-label="Toggle theme"
    >
      {/* Spotlight Glow - Green (Consistent) */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle 40px at center, rgba(29,185,84,0.25), transparent 100%)`,
        }}
      />

      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-yellow-500 group-hover:text-white transition-colors relative z-10" />
      ) : (
        <Moon className="h-5 w-5 text-neutral-600 group-hover:text-black transition-colors relative z-10" />
      )}
    </button>
  );
}