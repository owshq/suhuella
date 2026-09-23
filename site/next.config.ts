import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productSrc = path.join(monorepoRoot, "packages/product/src");
const productSrcTurbopack = path.relative(monorepoRoot, productSrc);
const siteNodeModules = path.join(monorepoRoot, "site/node_modules");
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
    config.resolve.modules = [siteNodeModules, ...(config.resolve.modules ?? ["node_modules"])];
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
        source: "/",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops",
      },
      {
        source: "/licenses",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/licenses",
      },
      {
        source: "/business",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/business",
      },
      {
        source: "/devices",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/devices",
      },
      {
        source: "/usage",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/usage",
      },
      {
        source: "/releases",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/releases",
      },
      {
        source: "/support",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/support",
      },
      {
        source: "/customers",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/customers",
      },
      {
        source: "/billing",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/billing",
      },
      {
        source: "/activity",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/ops/activity",
      },
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
        source: "/_ops",
        has: [{ type: "host", value: "suhuella.com" }],
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/_ops/:path*",
        has: [{ type: "host", value: "suhuella.com" }],
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/_ops",
        has: [{ type: "host", value: "www.suhuella.com" }],
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/ops",
        has: [{ type: "host", value: "suhuella.com" }],
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/ops/:path*",
        has: [{ type: "host", value: "suhuella.com" }],
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/ops",
        has: [{ type: "host", value: "www.suhuella.com" }],
        destination: operationsBaseUrl,
        permanent: true,
      },
      {
        source: "/_ops",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/",
        permanent: true,
      },
      {
        source: "/_ops/:path*",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/:path*",
        permanent: true,
      },
      {
        // Canonical ops URL is `/`. `/ops` in the browser bounced with the product
        // shell redirect and suhuella.com/ops → ERR_TOO_MANY_REDIRECTS after Access.
        source: "/ops",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/",
        permanent: false,
      },
      {
        source: "/ops/:path*",
        has: [{ type: "host", value: "ops.suhuella.com" }],
        destination: "/:path*",
        permanent: false,
      },
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
        source: "/download/success",
        destination: "/download/preparing",
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
        source: "/organise",
        destination: "/plan-mode",
        permanent: true,
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

// OpenNext starts workerd/miniflare. `npm run dev` sets SUHUELLA_DEV_OPENNEXT=0
// so Home/Sources/Settings do not wait on D1. Use `npm run dev:cf` (or
// SUHUELLA_DEV_OPENNEXT=1) for license, OTP, and worker parity.
if (process.env.NODE_ENV !== "production" && process.env.SUHUELLA_DEV_OPENNEXT !== "0") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
