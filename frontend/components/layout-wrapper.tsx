"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide Navbar and Footer on admin routes
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <>
      {!isAdmin && <Navbar />}
      <main className="grow w-full flex flex-col">
        {children}
      </main>
      {!isAdmin && <Footer />}
    </>
  );
}
