import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "UnlockChat", description: "Chat privately. Share images. Unlock the ones worth seeing." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
