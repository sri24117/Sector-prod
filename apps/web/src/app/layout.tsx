import type { ReactNode } from "react";

export const metadata = {
  title: "SEctOr",
  description: "NGO digital growth and intelligence platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
