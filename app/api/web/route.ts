import type { NextRequest } from "next/server";

import { translatePage } from "@/lib/webpage";

export const dynamic = "force-dynamic";

// The translated page is served from StoryCast's own origin, so the browser must not run anything in it.
const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
};

function errorPage(message: string, status: number) {
  const escaped = message.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return new Response(
    `<!doctype html><html lang="vi"><meta charset="utf-8"><body style="font:16px system-ui,sans-serif;` +
      `background:#171717;color:#e5e5e5;padding:24px"><p>${escaped}</p></body></html>`,
    { status, headers: PAGE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let target = params.get("url") ?? "";
  // A search form submitted from a translated page: rebuild the site's own search URL.
  const lang = params.get("lang") === "zh" ? "zh" : "vi";
  const formAction = params.get("form");
  if (formAction) {
    const url = new URL(formAction);
    for (const [key, value] of params) if (key !== "form" && key !== "lang") url.searchParams.append(key, value);
    target = url.toString();
  }

  let url: URL;
  try {
    url = new URL(target.trim());
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return errorPage("Link không hợp lệ. Hãy dán link bắt đầu bằng http:// hoặc https://", 400);
  }

  try {
    const proxyBase = new URL("/api/web", request.nextUrl.origin).toString();
    const storyBase = new URL("/new", request.nextUrl.origin).toString();
    return new Response(await translatePage(url.toString(), proxyBase, storyBase, lang), { headers: PAGE_HEADERS });
  } catch (err) {
    return errorPage(err instanceof Error ? err.message : String(err), 502);
  }
}
