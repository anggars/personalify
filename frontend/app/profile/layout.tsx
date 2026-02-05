import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Profile - Personalify",
    description: "View your Spotify profile, currently playing track, and account details.",
};

export default function ProfileLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <>{children}</>;
}
