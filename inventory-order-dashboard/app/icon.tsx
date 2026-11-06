import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#292824", color: "#F8F7F4", display: "flex", fontFamily: "sans-serif", fontSize: 176, fontWeight: 800, height: "100%", justifyContent: "center", letterSpacing: "-0.12em", width: "100%" }}>
      w
    </div>,
    { ...size },
  );
}
