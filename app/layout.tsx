import type { Metadata } from "next";
import ChatNotificationBanner from "./components/chat-notification-banner";
import AppNavigation from "./components/app-navigation";
import PullToRefresh from "./components/pull-to-refresh";
import "./globals.css";
import "./vardilo-theme.css";

export const metadata: Metadata = {
  icons: { apple: [{ url: "/app-icon/180", sizes: "180x180", type: "image/png" }] },
  title: "Vardilo — Mer tid tillsammans.",
  description: "Vardilo samlar familjens vardag på ett ställe.",
};

// Keep the root layout free of floating navigation/logo overlays.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body><ChatNotificationBanner /><AppNavigation /><PullToRefresh />{children}</body>
    </html>
  );
}
