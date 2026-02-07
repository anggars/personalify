# Personalify Frontend

The frontend is a modern **Next.js 14+** application using the **App Router**, styled with **Tailwind CSS** and **shadcn/ui**, and animated with **Framer Motion**. It fetches data from the FastAPI backend and renders a responsive dashboard.

## Project Structure

```bash
frontend/
├── app/                        # App Router Pages
│   ├── dashboard/              # Main User Dashboard ([id]/page.tsx)
│   ├── profile/                # User Profile & Real-time Playback
│   ├── lyrics/                 # Lyrics Analysis Pages (genius/page.tsx)
│   ├── about/                  # Project information & core mission
│   ├── privacy/                # Privacy Policy
│   ├── terms/                  # Terms of Service
│   ├── layout.tsx              # Root Layout (Fonts, Metadata)
│   └── page.tsx                # Home Page (Login & Tech Marquee)
├── components/                 # Reusable UI Components
│   ├── marquee-text.tsx        # Ping-pong scrolling text for long titles
│   ├── tech-hover.tsx          # Interactive tech stack exploration
│   ├── tech-stack-marquee.tsx  # Infinite scrolling stack icons
│   ├── navbar.tsx              # Responsive Navigation
│   ├── footer.tsx              # Multi-section application footer
│   └── ui/                     # shadcn/ui primitives
├── public/                     # Static Assets
│   └── assets/                 # Images, logos
└── tailwind.config.ts          # Design token configuration
```

## Key Features

- **Real-Time Playback Card**: Located on the **Profile page**, it tracks your Spotify session with pixel-perfect symmetry, high-fidelity metadata rendering (ping-pong marquee), and 1s local ticker progress accuracy.
- **Tech Stack Marquee & Hover**: Advanced interactive elements on the home page. Use the `TechHover` component to explore the stack details with smooth animations.
- **High-Fidelity Dashboard**: Comprehensive visualization of top spotify data using adaptive dark mode and liquid glass effects.
- **Lyrics Sentiment Analyzer**: Connects to the Genius API to analyze the emotional landscape of your favorite tracks using NLP models.
- **Universal Design Language**: Consistent premium aesthetics across Web and Mobile, achieved through standardized spacing and typography.
- **Legal & About Sections**: Dedicated pages for Privacy Policy, Terms of Service, and the project's About section.

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

### Setup & Run

Choose your preferred environment:

#### Option 1: Local Development (pnpm)
```bash
# Prerequisites: Node.js 18+, pnpm (recommended)
pnpm install
pnpm dev
```

#### Option 2: Docker
```bash
# Run via docker-compose from the project root
docker-compose up -d
```

Make sure the Backend is running on port `8000` for data fetching to work correctly.
