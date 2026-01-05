import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Lyrics Analyzer - Personalify",
    description: "Analyze the sentiment and meaning of any song lyrics.",
};

export default function LyricsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
