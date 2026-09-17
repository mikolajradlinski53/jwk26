import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Znak zastępczy do czasu, aż powstanie właściwa grafika żaby. Generowany przy
// budowaniu, więc w repozytorium nie ląduje żaden plik binarny do podmiany.
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
          background: "linear-gradient(160deg, #c8102e 0%, #6e0a1a 100%)",
          color: "#f4eeeb",
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
