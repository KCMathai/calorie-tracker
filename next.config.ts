import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: lets the app run at 127.0.0.1 too (a separate browser origin, handy for testing with empty storage).
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        // The notification service worker must never be cached, so phones always get the latest one.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
