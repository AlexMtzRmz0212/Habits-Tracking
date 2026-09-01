import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habits — three years of data",
  description:
    "Analyses drawn from three years of daily habit tracking: sleep, consistency, and follow-through.",
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
