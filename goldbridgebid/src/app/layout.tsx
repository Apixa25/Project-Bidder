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
  title: "projectxbidx — Sealed bids for every construction project",
  description:
    "Post your construction project and receive sealed bids from contractors. A technical, transparent marketplace for owners and bidders.",
  keywords: [
    "construction bidding",
    "contractor marketplace",
    "sealed bids",
    "construction projects",
    "projectxbidx",
  ],
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "projectxbidx — Sealed bids for every construction project",
    description:
      "Post your construction project and receive sealed bids from contractors.",
    images: [{ url: "/logo-mark.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
