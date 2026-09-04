import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          color: "white",
          fontSize: 72,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        SL
      </div>
    ),
    size
  );
}
