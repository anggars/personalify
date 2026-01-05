import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Genius Insights - Personalify",
    description: "Deep dive into song meanings with Genius integration.",
};

export default function GeniusLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
