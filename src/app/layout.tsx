import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getGoogleFontStylesheetHrefs } from "@/lib/canvas/googleFonts";
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
  title: "AI Creative Studio — Allyvate",
  description: "Ingestion-first AI creative studio for on-brand ad creatives and email campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {getGoogleFontStylesheetHrefs().map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
