import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chord PNG Studio",
  description: "A fast personal guitar chord diagram editor with transparent PNG export.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
