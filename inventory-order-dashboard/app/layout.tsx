import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wobuy174＿｜商品與庫存管理",
  description: "簡約韓系的商品、庫存與訂單建立管理系統。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
