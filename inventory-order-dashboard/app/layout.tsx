import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaSetup } from "./pwa-install";

export const metadata: Metadata = {
  title: "wobuy174＿｜商品與庫存管理",
  description: "簡約韓系的商品、庫存與訂單建立管理系統。",
  applicationName: "wobuy174",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "wobuy174",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#292824",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body><PwaSetup />{children}</body>
    </html>
  );
}
