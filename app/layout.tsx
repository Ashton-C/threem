import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import "./globals.css";

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "3M — Micro · Meso · Macro",
  description:
    "Type a game, get its Micro / Meso / Macro skill breakdown.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={display.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
