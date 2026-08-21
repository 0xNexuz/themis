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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Themis — Proof-carrying commerce for AI agents",
  description: "The trust and settlement layer for autonomous agents, powered by 0G.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Themis — Prove the work before payment",
    description: "Proof-carrying commerce for autonomous agents, powered by 0G.",
    images: [{ url: "/themis-handoff.png", width: 1536, height: 864 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Themis — Prove the work before payment",
    description: "Proof-carrying commerce for autonomous agents, powered by 0G.",
    images: ["/themis-handoff.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
