import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console - Personalify",
  description: "Administrative interface for Personalify system management.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
