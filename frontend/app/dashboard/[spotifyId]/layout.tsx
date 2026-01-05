import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Dashboard - Personalify",
    description: "Your personalized music insights.",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
