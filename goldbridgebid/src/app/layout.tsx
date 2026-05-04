import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";
import HydrationWatchdog from "@/components/HydrationWatchdog";

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
  manifest: "/manifest.json",
  openGraph: {
    title: "projectxbidx — Sealed bids for every construction project",
    description:
      "Post your construction project and receive sealed bids from contractors.",
    images: [{ url: "/logo-mark.png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      <head>
        {/* Inline self-healing watchdog — must render inside <head> so it
            executes before React hydration begins. If the page never comes
            alive within ~5s of full load, it unregisters service workers,
            clears caches, and reloads exactly once. */}
        <HydrationWatchdog />
      </head>
      <body className="min-h-full flex flex-col">
        <NextTopLoader
          color="#2563eb"
          crawlSpeed={200}
          height={4}
          easing="ease"
          speed={250}
          showSpinner={false}
          shadow="0 0 10px #2563eb,0 0 5px #2563eb"
        />
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
