import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/success",
        destination: "/download",
        permanent: false,
      },
      {
        source: "/descarga-exitosa",
        destination: "/download",
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
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
