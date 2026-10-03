import type { ReactNode } from "react";
import { Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";

// docs/design/design-system.pdf: Newsreader announces (score + page headlines only),
// Public Sans explains (everything else). next/font self-hosts both at build time.
const display = Newsreader({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-display", display: "swap", adjustFontFallback: false });
const sans = Public_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "SEctOr",
  description: "See how visible your NGO is to search and AI assistants, and get it fixed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
