import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Docs",
  description: "A local-first personal library for notes and code, organized in nested folders and stored in SQLite.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}