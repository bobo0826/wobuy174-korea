import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wobuy174 商品與庫存管理",
    short_name: "wobuy174",
    description: "商品、庫存、訂單與採購管理後台。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8F7F4",
    theme_color: "#292824",
    lang: "zh-Hant",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
