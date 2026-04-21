import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Print — ProjectXBidX",
  description: "Printable project summary",
};

/**
 * Minimal layout for print-friendly pages.
 *
 * This intentionally bypasses the (dashboard) layout so the dashboard sidebar,
 * header, and notifications are NOT rendered — bidders get a clean sheet of
 * paper when they hit Print (or Save as PDF) from their browser.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="print-root min-h-screen bg-white text-black">
      {children}
    </div>
  );
}
