import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Math Rock Analyzer - Personalify",
    description: "Discover the twinkly riffs and odd time signatures of your music with Multimodal AI.",
};

export default function AnalyzerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
