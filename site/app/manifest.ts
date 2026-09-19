import type { MetadataRoute } from "next";
import { brand } from "@suhuella/brand";

export function brandWebManifest(): MetadataRoute.Manifest {
  return {
    name: brand.pwa.name,
    short_name: brand.pwa.shortName,
    description: brand.pwa.description,
    start_url: brand.pwa.startUrl,
    display: "standalone",
    background_color: brand.pwa.backgroundColor,
    theme_color: brand.pwa.themeColor,
    icons: brand.pwa.icons.map((icon) => ({
      src: icon.src,
      sizes: icon.sizes,
      type: icon.type,
      purpose: icon.purpose,
    })),
  };
}

export default function manifest(): MetadataRoute.Manifest {
  return brandWebManifest();
}
