# Personalify Frontend

The frontend is a modern **Next.js 14+** application using the **App Router**, styled with **Tailwind CSS** and **shadcn/ui**, and animated with **Framer Motion**. It fetches data from the FastAPI backend and renders a responsive dashboard.

## Project Structure

```bash
frontend/
├── app/                  # App Router Pages
│   ├── dashboard/        # Main User Dashboard ([id]/page.tsx)
│   ├── lyrics/           # Lyrics Analysis Pages (genius/page.tsx)
│   ├── layout.tsx        # Root Layout (Fonts, Metadata)
│   └── page.tsx          # Home Page (Login & Tech Marquee)
├── components/           # Reusable UI Components
│   ├── tech-stack-marquee.tsx # Infinite scrolling stack icons
│   ├── glass-surface.tsx      # Liquid glass effect container
│   ├── navbar.tsx             # Responsive Navigation
│   ├── footer.tsx             # Application footer
│   └── ui/                    # shadcn/ui primitives
├── public/               # Static Assets
│   └── assets/           # Images, logos
└── tailwind.config.ts    # Design token configuration
```

## Key Features

- **Tech Stack Marquee**: Interactive Home Page element. Hovering the Spotify logo reveals a sliding marquee of the tech used (Next.js, FastAPI, Supabase, etc.).
- **Dashboard**: High-fidelity visualization of top artists, tracks, and genres with adaptive light/dark mode.
- **Lyrics Analyzer**: Integration with Genius API to search songs and analyze emotional sentiment using NLP.
- **Glassmorphism UI**: Custom "Liquid Glass" effects on buttons and cards using `glass-surface.tsx`.
- **Responsive Design**: Fully mobile-optimized layout with hamburger menus and touch-friendly controls.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React + Simple Icons (CDN)
- **Animation**: Framer Motion (Transitions, Marquee)
- **Fonts**: Plus Jakarta Sans (Google Fonts)

## Setup & Run

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
cd frontend
pnpm install
```

### Development Server

```bash
pnpm dev
# Runs on http://localhost:3000
```

Make sure the Backend is running on port `8000` for data fetching to work correctly.
