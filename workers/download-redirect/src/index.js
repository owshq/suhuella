/**
 * download.suhuella.com — stable aliases for desktop installers.
 * Clients never see github.com; MAC_LATEST_URL is operator-only (Wrangler var).
 */
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

    if (path === "/latest/win") {
      const target = env.WIN_LATEST_URL?.trim();
      if (!target) {
        return new Response("Windows installer not published yet.", { status: 404 });
      }
      return Response.redirect(target, 302);
    }

    if (path === "/" || path === "/health") {
      return new Response("SuHuella download redirect\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
