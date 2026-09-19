export type AppOverlayRoute = "landing" | "license" | "downloads" | "success";

const OVERLAY_PATHS: Record<AppOverlayRoute, string> = {
  landing: "/",
  license: "/license",
  downloads: "/download",
  success: "/license/success",
};

export function openAppOverlay(route: AppOverlayRoute): void {
  if (typeof window === "undefined") return;
  window.location.assign(OVERLAY_PATHS[route]);
}

export function appOverlayHref(route: AppOverlayRoute): string {
  return OVERLAY_PATHS[route];
}
