import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only: lets the app run at 127.0.0.1 too (a separate browser origin, handy for testing with empty storage).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
