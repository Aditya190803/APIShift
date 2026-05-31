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
  title: "APIShift — Smart LLM Failover for Python & TypeScript",
  description:
    "Universal LLM orchestration with intelligent failover, free-tier-first routing, and context-preserving provider switching. Available for Python and Node.js.",
  keywords: [
    "LLM",
    "failover",
    "AI orchestration",
    "OpenRouter",
    "Gemini",
    "Vercel AI SDK",
    "API gateway",
    "Python",
    "TypeScript",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
