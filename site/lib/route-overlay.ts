export const ROUTE_OVERLAY_PATHS = {
  landing: "/",
  license: "/license",
  download: "/download",
  success: "/license/success",
} as const;

export type RouteOverlay = keyof typeof ROUTE_OVERLAY_PATHS;

export function overlayFromPathname(pathname: string): RouteOverlay | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "landing";
  if (path === "/license") return "license";
  if (path === "/download") return "download";
  if (path === "/license/success" || path === "/success" || path === "/descarga-exitosa") {
    return "success";
  }
  return null;
}

export function overlayHomePath(): string {
  return "/home";
}
