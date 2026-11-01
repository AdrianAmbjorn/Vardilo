import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./vardilo-theme.css";

export const metadata: Metadata = {
  title: "Vardilo — Family life, together.",
  description: "Vardilo samlar familjens vardag på ett ställe.",
};

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor" />
      <path d="M9.1 20v-5.2h5.8V20" fill="white" />
    </svg>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>
        <Link
          href="/"
          aria-label="Vardilo – gå till Hem"
          title="Till Hem"
          style={{
            position: "fixed",
            top: 16,
            left: 18,
            zIndex: 100,
            width: 42,
            height: 42,
            display: "grid",
            placeItems: "center",
            borderRadius: 13,
            background: "#c62828",
            color: "white",
            boxShadow: "0 8px 20px rgba(16, 42, 67, .16)",
            textDecoration: "none",
          }}
        >
          <HouseIcon />
        </Link>
        {children}
      </body>
    </html>
  );
}
