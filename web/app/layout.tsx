import type { Metadata, Viewport } from "next";
import {
  Caveat,
  Gochi_Hand,
  Homemade_Apple,
  Kalam,
  La_Belle_Aurore,
  Patrick_Hand,
} from "next/font/google";

import PaperDefs from "@/components/book/PaperDefs";
import "./globals.css";

// The diary is written by hand, so the fonts are the handwriting: ink-pen
// cursive for titles, a readable hand for the entries, crayon for labels and
// charts, and a plain print hand for numbers so stats stay legible.
const ink = Homemade_Apple({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ink",
  display: "swap",
});
const inkSmall = La_Belle_Aurore({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ink-small",
  display: "swap",
});
const body = Kalam({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const margin = Caveat({
  subsets: ["latin"],
  variable: "--font-margin",
  display: "swap",
});
const crayon = Gochi_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crayon",
  display: "swap",
});
const numbers = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-numbers",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dear habits…",
  description:
    "A habit journal, written as letters to the daily habits I've tracked since 2023: when each began, how it went, and why it faded or ended.",
};

// The colour of the desk, so the browser chrome matches the page edge to edge.
export const viewport: Viewport = { themeColor: "#1c110a" };

// Runs before first paint so a returning visitor never sees the closed cover
// flash by: if the diary was opened this session, or the address points at a
// page inside it, the cover starts out open. Book.tsx owns the real state.
const OPEN_BEFORE_PAINT = `try{var h=location.hash.slice(1);if(h||sessionStorage.getItem("diary-open")==="1")document.documentElement.setAttribute("data-open","1")}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fonts = [ink, inkSmall, body, margin, crayon, numbers]
    .map((f) => f.variable)
    .join(" ");

  return (
    // data-open is set by the script below before React hydrates, on purpose.
    <html lang="en" className={fonts} suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Skip to the diary
        </a>
        <script dangerouslySetInnerHTML={{ __html: OPEN_BEFORE_PAINT }} />
        <PaperDefs />
        {children}
      </body>
    </html>
  );
}
