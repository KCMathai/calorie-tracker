import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/AppIconArt";

/** iPhone home-screen icon (iOS rounds the corners itself). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} padding={0.14} rounded={false} />, size);
}
