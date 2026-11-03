import type { Metadata, Viewport } from "next";

import "./dashboard.css";

// A root layout of its own: the private dashboard shares no markup or styles
// with the public diary, and moving between the two is a full page load, so
// the diary's CSS never leaks in.
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fbfaf8" };

export default function DashboardLayout({
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
