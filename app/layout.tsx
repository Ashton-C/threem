import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3M Breakdown",
  description:
    "Type a game, get its Micro / Meso / Macro skill breakdown.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
