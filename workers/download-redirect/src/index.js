/**
 * download.suhuella.com — public stable distribution API.
 *
 * Stable aliases (docs, support, scripts, updaters, email links):
 *   GET /latest/mac          → 302 to current macOS installer
 *   GET /latest/mac.sha256   → 302 to GNU sha256 sidecar for macOS installer
 *   GET /latest/win            → 302 to current Windows installer
 *   GET /latest/win.sha256     → 302 to GNU sha256 sidecar for Windows installer
 *
 * The website consumes these aliases internally; users normally stay on suhuella.com.
 * MAC_LATEST_URL / WIN_LATEST_URL are operator-only Wrangler vars (GitHub asset URLs).
 */
function sidecarUrl(installerUrl) {
  return installerUrl
    .replace(/\.dmg(\?.*)?$/i, ".dmg.sha256$1")
    .replace(/\.exe(\?.*)?$/i, ".exe.sha256$1");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/latest/mac") {
      const target = env.MAC_LATEST_URL?.trim();
      if (!target) {
        return new Response("Mac installer not published yet.", { status: 404 });
      }
      return Response.redirect(target, 302);
    }

    if (path === "/latest/mac.sha256") {
      const target = env.MAC_LATEST_URL?.trim();
      if (!target) {
        return new Response("Mac installer not published yet.", { status: 404 });
      }
      return Response.redirect(sidecarUrl(target), 302);
    }

    if (path === "/latest/win") {
      const target = env.WIN_LATEST_URL?.trim();
      if (!target) {
        return new Response("Windows installer not published yet.", { status: 404 });
      }
      return Response.redirect(target, 302);
    }

    if (path === "/latest/win.sha256") {
      const target = env.WIN_LATEST_URL?.trim();
      if (!target) {
        return new Response("Windows installer not published yet.", { status: 404 });
      }
      return Response.redirect(sidecarUrl(target), 302);
    }

    if (path === "/" || path === "/health") {
      return new Response(
        "SuHuella download distribution API\n/latest/mac\n/latest/mac.sha256\n/latest/win\n/latest/win.sha256\n",
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
