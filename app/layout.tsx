import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "信男代購 wobuy174_｜日韓代購・嘉義朴子實體店面",
  description:
    "信男代購 wobuy174_ 精選日韓生活小物、韓國棉被與各式選品。新品及連線資訊於 LINE 社群發布，詢價與私訊下單請洽 LINE@。",
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
