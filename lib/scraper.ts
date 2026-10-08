import "server-only";

import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

// Known containers for chapter text on Vietnamese & Chinese story sites. Anything else falls back to Readability.
const CONTENT_SELECTORS = [
  "#chapter-c",
  ".chapter-c",
  "#chapter-content",
  ".chapter-content",
  "#chr-content",
  ".chr-c",
  "#content-chapter",
  ".content-chapter",
  ".chapter__content",
  ".box-chap",
  "#bookContent",
  ".reading-content",
  ".reading-detail .content",
  "#vungdoc",
  "[itemprop=articleBody]",
  "article .entry-content",
  // Common Chinese story site selectors (69shu, biquge, etc.)
  "#content",
  "#chaptercontent",
  "#htmlContent",
  "#txtContent",
  ".txtnav",
  "#contenttxt",
  "#BookText",
  "#nr1",
  "#nr",
  ".read-content",
];

const CHAPTER_TITLE_SELECTORS = [
  ".chapter-title",
  ".chapter-name",
  ".chr-title",
  "h2.title",
  ".current-chapter",
  ".bookname h1",
  ".readTitle",
  "h1.title",
  "h1",
];
const STORY_TITLE_SELECTORS = [".truyen-title", ".story-title", "h3.title", "[itemprop=name]", ".book-name", ".booktitle", "h1"];
const NEXT_SELECTORS = [
  "#next_chap",
  "#next_chapter",
  "a.next-chap",
  "a.btn-next",
  "a[rel=next]",
  "link[rel=next]",
  "#next_url",
  "#nextChapter",
  "#linkNext",
  "a#A3",
  "#pt_next",
];
const NEXT_TEXT = /(chương\s*(sau|tiếp|kế)|tiếp\s*theo|next\s*chap|^\s*next\s*$|^\s*sau\s*[»>›]?\s*$|下一[章页節]|下[一頁]|后一[章页]|Next)/i;

// Lines that are site boilerplate rather than story text.
const JUNK_LINE =
  /(truyenfull|bạn đang đọc truyện|nguồn\s*:|đọc truyện (online|chữ)|chương trước|chương sau|https?:\/\/|www\.|\.(com|net|vn|io|live|today|cn|org)\b|請收藏本站|请收藏本站|手機用戶請瀏覽|手机用户请浏览|最新網址|最新网址)/i;

export interface PageInfo {
  url: string;
  storyTitle: string | null;
  chapterTitle: string | null;
  author: string | null;
  coverUrl: string | null;
  text: string;
  nextUrl: string | null;
  firstChapterUrl: string | null;
  // The URL itself names a chapter (".../chuong-12/"), as opposed to a story overview page.
  isChapterUrl: boolean;
}

export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "vi-VN,vi;q=0.9,zh-CN,zh;q=0.8,en;q=0.7",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Trang trả về lỗi ${res.status}`);
      return { html: await res.text(), finalUrl: res.url || url };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(`Không tải được trang ${url}: ${lastError instanceof Error ? lastError.message : lastError}`);
}

export async function scrapePage(url: string): Promise<PageInfo> {
  const { html, finalUrl } = await fetchHtml(url);
  return parsePage(html, finalUrl);
}

export function parsePage(html: string, url: string): PageInfo {
  // Story sites ship huge stylesheets that jsdom cannot parse; we don't need them.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { url, virtualConsole });
  const doc = dom.window.document;

  const meta = (prop: string) =>
    doc.querySelector(`meta[property="${prop}"]`)?.getAttribute("content")?.trim() || null;

  const storyTitle =
    firstText(doc, STORY_TITLE_SELECTORS) || meta("og:title") || doc.title.split(/[-|:]/)[0].trim() || null;
  const author = doc.querySelector("[itemprop=author]")?.textContent?.trim() || null;
  const coverUrl = meta("og:image");
  const nextUrl = findNextUrl(doc, url);
  const firstChapterUrl = findFirstChapterUrl(doc, url);

  doc.querySelectorAll('script, style, noscript, iframe, ins, [id^="ads"], [class^="ads"], [class*=" ads"]').forEach((el) => el.remove());

  let text = "";
  for (const selector of CONTENT_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el) {
      const candidate = cleanText(elementToText(el));
      if (candidate.length > 300) {
        text = candidate;
        break;
      }
    }
  }
  if (!text) {
    const article = new Readability(doc.cloneNode(true) as Document).parse();
    if (article?.content) {
      const fragment = JSDOM.fragment(article.content);
      text = cleanText(elementToText(fragment));
    }
  }

  let chapterTitle = firstText(doc, CHAPTER_TITLE_SELECTORS);
  if (chapterTitle && storyTitle && chapterTitle.startsWith(storyTitle)) {
    chapterTitle = chapterTitle.slice(storyTitle.length).replace(/^\s*[-:|]\s*/, "").trim() || chapterTitle;
  }

  return {
    url,
    storyTitle: storyTitle ? fixText(storyTitle) : null,
    chapterTitle: chapterTitle ? fixText(chapterTitle) : null,
    author: author ? fixText(author) : null,
    coverUrl,
    text,
    nextUrl,
    firstChapterUrl,
    isChapterUrl: CHAPTER_NUMBER.test(decodeURI(new URL(url).pathname)),
  };
}

function firstText(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const text = (el?.getAttribute("title") || el?.textContent || "").replace(/\s+/g, " ").trim();
    if (text && text.length < 300) return text;
  }
  return null;
}

function resolveLink(href: string | null | undefined, base: string): string | null {
  if (!href || href.startsWith("javascript:") || href.startsWith("#")) return null;
  try {
    const resolved = new URL(href, base);
    if (!/^https?:$/.test(resolved.protocol)) return null;
    resolved.hash = "";
    // Tracking params like ?utm_source=... make the same chapter look like a different URL.
    for (const key of [...resolved.searchParams.keys()]) {
      if (key.startsWith("utm_")) resolved.searchParams.delete(key);
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function sameUrl(a: string, b: string) {
  const norm = (u: string) => u.replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/, "");
  return norm(a) === norm(b);
}

function findNextUrl(doc: Document, url: string): string | null {
  for (const selector of NEXT_SELECTORS) {
    for (const el of doc.querySelectorAll(selector)) {
      if (el.classList.contains("disabled")) continue;
      const link = resolveLink(el.getAttribute("href"), url);
      if (link && !sameUrl(link, url)) return link;
    }
  }
  for (const a of doc.querySelectorAll("a[href]")) {
    const label = `${a.textContent ?? ""} ${a.getAttribute("title") ?? ""}`.trim();
    if (!NEXT_TEXT.test(label)) continue;
    const link = resolveLink(a.getAttribute("href"), url);
    if (link && !sameUrl(link, url)) return link;
  }
  return null;
}

const CHAPTER_NUMBER = /(?:chuong|chương|chapter|chap|第)[-_\s]*0*(\d+)/i;

// On a story's overview page, find the link to its first chapter.
function findFirstChapterUrl(doc: Document, url: string): string | null {
  let best: { n: number; link: string } | null = null;
  for (const a of doc.querySelectorAll("a[href]")) {
    const link = resolveLink(a.getAttribute("href"), url);
    if (!link) continue;
    const label = (a.textContent ?? "").trim();
    if (/đọc từ đầu|đọc truyện|read from beginning|start reading|开始阅读|從頭閱讀|从头阅读/i.test(label) && CHAPTER_NUMBER.test(link)) {
      return link;
    }
    const match = decodeURI(new URL(link).pathname).match(CHAPTER_NUMBER) || label.match(CHAPTER_NUMBER);
    if (!match) continue;
    const n = Number(match[1]);
    if (!best || n < best.n) best = { n, link };
  }
  return best?.link ?? null;
}

const BLOCK_TAGS = new Set([
  "P", "DIV", "BR", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "SECTION", "ARTICLE", "TR", "HR",
]);

// textContent glues paragraphs together; walk the tree and keep line breaks at block boundaries.
function elementToText(root: Node): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push(node.nodeValue ?? "");
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    const tag = (node as Element).tagName;
    const isBlock = tag !== undefined && BLOCK_TAGS.has(tag);
    if (isBlock) parts.push("\n");
    node.childNodes.forEach(walk);
    if (isBlock) parts.push("\n");
  };
  walk(root);
  return parts.join("");
}

// Some sites swap letters for "*" to stop copy-paste: "c*̉a" → "của", "c*̃ng" → "cũng".
export function fixText(text: string): string {
  return text
    .replace(/\*(?=[̀-ͯ])/g, "u")
    .normalize("NFC")
    .replace(/ /g, " ");
}

function cleanText(raw: string): string {
  return fixText(raw)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line && !(line.length < 160 && JUNK_LINE.test(line)))
    .join("\n");
}
