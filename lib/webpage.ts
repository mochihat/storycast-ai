import "server-only";

import { JSDOM, VirtualConsole } from "jsdom";

import { convertSnippets } from "./convert";
import { fetchHtml, fetchPo18ChapterHtml, isPo18Url } from "./scraper";

// Browses a Chinese website in Vietnamese: fetches the page (with the PO18 login when it is PO18), converts every
// piece of visible text, and points its links back through StoryCast so the next page is converted too.

const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const TRANSLATED_ATTRIBUTES = ["title", "alt", "placeholder", "aria-label"];

export function proxiedUrl(target: string, proxyBase: string): string {
  return `${proxyBase}?url=${encodeURIComponent(target)}`;
}

function absolute(href: string | null, base: string): string | null {
  if (!href || /^(javascript|mailto|tel|data):/i.test(href.trim())) return null;
  try {
    const url = new URL(href, base);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function translatePage(url: string, proxyBase: string, storyBase: string): Promise<string> {
  const { html, finalUrl } = await fetchHtml(url);
  if (/members\.po18\.tw/i.test(new URL(finalUrl).hostname) && /login/i.test(finalUrl)) {
    throw new Error(
      "PO18 yêu cầu đăng nhập. Cookie trong .env.local đã hết hạn hoặc chưa có: hãy lấy cookie mới rồi khởi động lại ứng dụng."
    );
  }
  const dom = new JSDOM(html, { url: finalUrl, virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;

  // The page is shown on StoryCast's own origin, so none of the site's code may run there.
  doc.querySelectorAll("script, noscript, iframe, object, embed, link[rel=preload], link[rel=modulepreload]").forEach(
    (el) => el.remove()
  );
  doc.querySelectorAll("meta[http-equiv]").forEach((el) => el.remove());
  // Comments often hold old markup (even commented-out scripts) that would only be translated for nothing.
  const comments = doc.createTreeWalker(doc.documentElement, dom.window.NodeFilter.SHOW_COMMENT);
  const dead: Node[] = [];
  for (let node = comments.nextNode(); node; node = comments.nextNode()) dead.push(node);
  dead.forEach((node) => node.parentNode?.removeChild(node));
  for (const el of doc.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  }

  // PO18 chapter text is loaded by a script we just removed: fetch it here instead.
  if (isPo18Url(finalUrl) && /^\/books\/\d+\/articles\/\d+/.test(new URL(finalUrl).pathname)) {
    const box = doc.querySelector(".read-txt");
    if (box) {
      box.innerHTML = await fetchPo18ChapterHtml(finalUrl);
      box.querySelectorAll("blockquote.copyright").forEach((el) => el.remove());
    }
  }

  // Images, stylesheets and fonts still load straight from the site; links come back through StoryCast.
  for (const el of doc.querySelectorAll("[src]")) {
    const src = absolute(el.getAttribute("src"), finalUrl);
    if (src) el.setAttribute("src", src);
  }
  for (const el of doc.querySelectorAll("link[href]")) {
    const href = absolute(el.getAttribute("href"), finalUrl);
    if (href) el.setAttribute("href", href);
  }
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = absolute(a.getAttribute("href"), finalUrl);
    if (href) a.setAttribute("href", proxiedUrl(href, proxyBase));
    else a.removeAttribute("href");
    a.removeAttribute("target");
  }
  // GET forms (searches on most sites) keep working through StoryCast; other forms cannot be replayed.
  for (const form of doc.querySelectorAll("form")) {
    const action = absolute(form.getAttribute("action") || finalUrl, finalUrl);
    if ((form.getAttribute("method") ?? "get").toLowerCase() === "get" && action) {
      form.setAttribute("action", proxyBase);
      const hidden = doc.createElement("input");
      Object.assign(hidden, { type: "hidden", name: "form", value: action });
      form.prepend(hidden);
    } else {
      form.removeAttribute("action");
    }
  }

  // Collect every visible piece of Chinese text, convert them in one go, and put them back.
  const walker = doc.createTreeWalker(doc.documentElement, dom.window.NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement?.tagName;
    if (parent !== "STYLE" && CJK.test(node.nodeValue ?? "")) textNodes.push(node as Text);
  }
  const attributes: { el: Element; name: string }[] = [];
  for (const el of doc.querySelectorAll("*")) {
    for (const name of TRANSLATED_ATTRIBUTES) {
      if (CJK.test(el.getAttribute(name) ?? "")) attributes.push({ el, name });
    }
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.getAttribute("type") ?? "")) {
      if (CJK.test(el.getAttribute("value") ?? "")) attributes.push({ el, name: "value" });
    }
  }
  const converted = await convertSnippets([
    ...textNodes.map((node) => node.nodeValue ?? ""),
    ...attributes.map(({ el, name }) => el.getAttribute(name) ?? ""),
  ]);
  textNodes.forEach((node, i) => {
    // Chinese needs no spaces between inline pieces ("<b>作者</b>青涩"); Vietnamese words do.
    const before = /^\s/.test(node.nodeValue ?? "") || node.previousSibling ? " " : "";
    const after = /\s$/.test(node.nodeValue ?? "") || node.nextSibling ? " " : "";
    node.nodeValue = before + converted[i] + after;
  });
  attributes.forEach(({ el, name }, i) => el.setAttribute(name, converted[textNodes.length + i]));

  doc.documentElement.setAttribute("lang", "vi");
  const meta = doc.createElement("meta");
  meta.setAttribute("charset", "utf-8");
  doc.head.prepend(meta);

  // A slim bar on top: where this page really is, and a shortcut to turn the story into audio.
  const bar = doc.createElement("div");
  bar.setAttribute(
    "style",
    "position:sticky;top:0;z-index:2147483647;display:flex;flex-wrap:wrap;gap:12px;align-items:center;" +
      "padding:8px 16px;background:#064e3b;color:#fff;font:14px/1.4 system-ui,sans-serif"
  );
  const label = doc.createElement("span");
  label.textContent = "Bản convert của";
  const original = doc.createElement("a");
  original.textContent = new URL(finalUrl).hostname + new URL(finalUrl).pathname;
  original.setAttribute("href", finalUrl);
  original.setAttribute("target", "_blank");
  original.setAttribute("rel", "noreferrer");
  original.setAttribute("style", "color:#6ee7b7;word-break:break-all");
  bar.append(label, original);
  if (/^\/books\/\d+/.test(new URL(finalUrl).pathname) || !isPo18Url(finalUrl)) {
    const audio = doc.createElement("a");
    audio.textContent = "🎧 Tạo audio truyện này";
    audio.setAttribute("href", `${storyBase}?url=${encodeURIComponent(finalUrl)}`);
    audio.setAttribute("target", "_top");
    audio.setAttribute(
      "style",
      "margin-left:auto;padding:4px 12px;border-radius:999px;background:#10b981;color:#000;font-weight:600;text-decoration:none"
    );
    bar.append(audio);
  }
  doc.body.prepend(bar);

  return dom.serialize();
}
