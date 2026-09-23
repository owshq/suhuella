import {
  desktopDownloadRouteResponse,
  resolveDesktopDownloadRoute,
} from "@/lib/desktop-download-route";
import { getReleaseManifest } from "@/lib/release-manifest";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ platform: string }> },
) {
  const { platform } = await context.params;
  const manifest = await getReleaseManifest();
  return desktopDownloadRouteResponse(resolveDesktopDownloadRoute(platform, manifest));
}
