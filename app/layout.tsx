import type { Metadata, Viewport } from "next";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "타이거즈 뉴스",
  description: "기아 타이거즈 팬을 위한 KBO 뉴스 PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "타이거즈 뉴스",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/tigers-news.svg",
    apple: "/icons/tigers-news.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#C41230",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
