import { Metadata } from "next";

export const metadata: Metadata = {
    title: "About - Personalify",
    description: "Explorations in code, music, and the spaces in between.",
};

export default function AboutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
