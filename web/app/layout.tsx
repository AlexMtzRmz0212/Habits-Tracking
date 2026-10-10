import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dear habits…",
  description:
    "A habit journal, written as letters to the daily habits I've tracked since 2023: when each began, how it went, and why it faded or ended.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
