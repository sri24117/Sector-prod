import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

// docs/design/design-system.pdf: Newsreader announces (score + page headlines only),
// Public Sans explains (everything else). The variable-weight Latin files are
// committed in src/fonts (SIL OFL) so `next build` needs no network access.
const display = localFont({
  src: "../fonts/newsreader-latin-var.woff2",
  weight: "400 500",
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: false,
});
const sans = localFont({
  src: "../fonts/public-sans-latin-var.woff2",
  weight: "400 600",
  variable: "--font-sans",
  display: "swap",
});

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
