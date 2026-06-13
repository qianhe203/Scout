import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const internalApiPort = process.env.INTERNAL_API_PORT ?? "3001";
const internalApiOrigin = `http://127.0.0.1:${internalApiPort}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(root, "../.."),
  async rewrites() {
    return [
      { source: "/health", destination: `${internalApiOrigin}/health` },
      { source: "/runs", destination: `${internalApiOrigin}/runs` },
      { source: "/runs/:path*", destination: `${internalApiOrigin}/runs/:path*` },
    ];
  },
};

export default nextConfig;
