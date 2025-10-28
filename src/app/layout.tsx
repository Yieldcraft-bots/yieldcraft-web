// src/app/layout.tsx
import NavBar from "../components/NavBar";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YieldCraft",
  description: "Pulse + Recon • Institutional-grade automation made simple.",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
