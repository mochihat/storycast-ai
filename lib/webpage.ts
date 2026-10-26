import "server-only";

import { JSDOM, VirtualConsole } from "jsdom";

import { convertSnippets } from "./convert";
import { fetchHtml, fetchPo18ChapterHtml, isPo18Url } from "./scraper";

// Browses a Chinese website in Vietnamese: fetches the page (with the PO18 login when it is PO18), converts every
// piece of visible text, and points its links back through StoryCast so the next page is converted too.
// The same page can also be shown untranslated ("zh"), to compare it with the original side by side.

export type PageLanguage = "vi" | "zh";

const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const TRANSLATED_ATTRIBUTES = ["title", "alt", "placeholder", "aria-label"];

export function proxiedUrl(target: string, proxyBase: string, lang: PageLanguage = "vi"): string {
  return `${proxyBase}?url=${encodeURIComponent(target)}${lang === "zh" ? "&lang=zh" : ""}`;
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

export async function translatePage(
  url: string,
  proxyBase: string,
  storyBase: string,
  lang: PageLanguage = "vi"
): Promise<string> {
  const { html, finalUrl } = await fetchHtml(po18TagUrl(url));
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

  if (isPo18Url(finalUrl) && /^\/tags(\/viewindex)?\/?$/.test(new URL(finalUrl).pathname)) {
    po18TagFilter(doc, finalUrl, proxyBase, lang);
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
    if (href) a.setAttribute("href", proxiedUrl(href, proxyBase, lang));
    else a.removeAttribute("href");
    a.removeAttribute("target");
  }
  // GET forms (searches on most sites) keep working through StoryCast; other forms cannot be replayed.
  for (const form of doc.querySelectorAll("form:not([data-storycast])")) {
    const action = absolute(form.getAttribute("action") || finalUrl, finalUrl);
    if ((form.getAttribute("method") ?? "get").toLowerCase() === "get" && action) {
      form.setAttribute("action", proxyBase);
      const hidden = doc.createElement("input");
      Object.assign(hidden, { type: "hidden", name: "form", value: action });
      form.prepend(hidden);
      if (lang === "zh") {
        const keepLang = doc.createElement("input");
        Object.assign(keepLang, { type: "hidden", name: "lang", value: "zh" });
        form.prepend(keepLang);
      }
    } else {
      form.removeAttribute("action");
    }
  }

  if (lang === "vi") await convertDocument(doc, dom.window);

  doc.documentElement.setAttribute("lang", lang === "vi" ? "vi" : "zh");
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
  label.textContent = lang === "vi" ? "Bản convert của" : "Bản gốc tiếng Trung:";
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

// PO18's tag search filters with a script (ticking a box reloads the list from /tags/subbooks). Scripts are
// removed here, so the boxes become a plain form instead: it submits the ticked tags as ?tag=30&tag=68, which
// po18TagUrl turns into the site's own filtered page, /tags?id=30_68_.
function po18TagUrl(url: string): string {
  const parsed = new URL(url);
  const tags = parsed.searchParams.getAll("tag").filter((tag) => /^\d+$/.test(tag));
  if (!isPo18Url(url) || !/^\/tags(\/viewindex)?\/?$/.test(parsed.pathname) || tags.length === 0) return url;
  return `${parsed.origin}/tags?id=${tags.join("_")}_`;
}

function po18TagFilter(doc: Document, pageUrl: string, proxyBase: string, lang: PageLanguage) {
  const box = doc.querySelector(".selecttags .T_wrapbox");
  if (!box) return;
  const selected = new Set((new URL(pageUrl).searchParams.get("id") ?? "").split("_").filter(Boolean));
  const origin = new URL(pageUrl).origin;

  const form = doc.createElement("form");
  form.setAttribute("method", "get");
  form.setAttribute("action", proxyBase);
  form.setAttribute("data-storycast", ""); // already points at StoryCast: the form pass below leaves it alone
  const hidden = (name: string, value: string) => {
    const input = doc.createElement("input");
    Object.assign(input, { type: "hidden", name, value });
    form.append(input);
  };
  hidden("form", `${origin}/tags/viewindex`);
  if (lang === "zh") hidden("lang", "zh");
  box.replaceWith(form);
  form.append(box);
  for (const input of box.querySelectorAll<HTMLInputElement>("input.tags-select")) {
    input.setAttribute("name", "tag");
    input.removeAttribute("id"); // every box shares one id on PO18
    if (selected.has(input.value)) input.setAttribute("checked", "");
  }

  const actions = doc.createElement("div");
  actions.setAttribute("style", "display:flex;gap:12px;align-items:center;margin:12px 0");
  const submit = doc.createElement("button");
  submit.setAttribute("type", "submit");
  submit.textContent = lang === "vi" ? "Lọc truyện theo tag đã chọn" : "篩選";
  submit.setAttribute(
    "style",
    "padding:8px 20px;border:0;border-radius:999px;background:#10b981;color:#000;font-weight:600;cursor:pointer"
  );
  actions.append(submit);
  if (selected.size > 0) {
    const clear = doc.createElement("a");
    clear.textContent = lang === "vi" ? "Bỏ chọn tất cả" : "清除";
    // A site link like any other: the link pass below routes it through StoryCast.
    clear.setAttribute("href", `${origin}/tags/viewindex`);
    actions.append(clear);
  }
  form.append(actions);
}

// Collects every visible piece of Chinese text, converts them in one go, and puts them back.
async function convertDocument(doc: Document, window: JSDOM["window"]) {
  const walker = doc.createTreeWalker(doc.documentElement, window.NodeFilter.SHOW_TEXT);
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
}
