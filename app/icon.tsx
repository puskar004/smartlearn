import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          color: "white",
          fontSize: 18,
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
