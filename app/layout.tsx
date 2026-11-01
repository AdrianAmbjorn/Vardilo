import type { Metadata } from "next";
import "./globals.css";
import "./vardilo-theme.css";

export const metadata: Metadata = {
  title: "Vardilo — Family life, together.",
  description: "Vardilo samlar familjens vardag på ett ställe.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
