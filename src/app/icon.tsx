import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/AppIconArt";

/** App icons for browsers and the home screen, drawn from code (see AppIconArt). */
export function generateImageMetadata() {
  return [
    { id: "192", contentType: "image/png", size: { width: 192, height: 192 } },
    { id: "512", contentType: "image/png", size: { width: 512, height: 512 } },
    // Android crops "maskable" icons to circles/squircles, so the art needs more padding.
    { id: "maskable", contentType: "image/png", size: { width: 512, height: 512 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const which = String(await id);
  const size = which === "192" ? 192 : 512;
  return new ImageResponse(<AppIconArt size={size} padding={which === "maskable" ? 0.2 : 0.12} rounded={which !== "maskable"} />, {
    width: size,
    height: size,
  });
}
