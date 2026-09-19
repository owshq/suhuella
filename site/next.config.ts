import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productSrc = path.join(monorepoRoot, "packages/product/src");
const productSrcTurbopack = path.relative(monorepoRoot, productSrc);

const operationsBaseUrl =
  process.env.OPS_BASE_URL?.trim().replace(/\/$/, "") ||
  "https://ops.suhuella.com";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  // Cloudflare Workers cannot bundle sharp's native .node bindings.
  images: { unoptimized: true },
  serverExternalPackages: ["sharp"],
  outputFileTracingExcludes: {
    "*": ["./node_modules/sharp/**", "./node_modules/@img/**"],
  },
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      "@suhuella/product": productSrcTurbopack,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@suhuella/product": productSrc,
    };
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".ts": [".ts", ".tsx"],
      ".tsx": [".tsx"],
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/_ops",
        destination: "/ops",
      },
      {
        source: "/_ops/:path*",
        destination: "/ops/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/admin/:path*",
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/success",
        destination: "/license/success",
        permanent: false,
      },
      {
        source: "/descarga-exitosa",
        destination: "/license/success",
        permanent: false,
      },
      {
        source: "/privacidad",
        destination: "/privacy",
        permanent: false,
      },
      {
        source: "/terminos",
        destination: "/terms",
        permanent: false,
      },
      {
        source: "/app",
        destination: "/home",
        permanent: true,
      },
      {
        source: "/app/:path*",
        destination: "/home",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

if (process.env.NODE_ENV !== "production") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
