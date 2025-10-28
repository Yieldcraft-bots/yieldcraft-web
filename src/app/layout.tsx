import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YieldCraft",
  description: "Pulse + Recon • Institutional-grade automation made simple.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0B1220] text-white`}>
        {/* Simple top nav */}
        <header className="w-full border-b border-white/10 bg-[#0B1220]">
          <nav className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
            <a href="/" className="font-semibold">YieldCraft</a>
            <a href="/quick-start" className="px-3 py-1 rounded-lg hover:bg-white/10">QuickStart</a>
            <a href="/affiliate" className="px-3 py-1 rounded-lg hover:bg-white/10">Affiliate</a>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
