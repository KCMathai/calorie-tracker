import type { MetadataRoute } from "next";

/** Lets phones install the app to the home screen and open it full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Calorie Tracker",
    short_name: "Calories",
    description: "Track your daily calories and stay on target.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d0b",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
