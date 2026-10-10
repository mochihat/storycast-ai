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

export function isWattpadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /(?:^|\.)wattpad\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function scrapeWattpad(url: string): Promise<PageInfo> {
  const parsedUrl = new URL(url);
  const pathname = decodeURI(parsedUrl.pathname);

  const storyMatch = pathname.match(/^\/story\/(\d+)/i);
  const partMatch = pathname.match(/^\/(\d+)(?:-[^/]+)?(?:\/page\/\d+)?/i);

  // If chapter link has /page/N, fetch the base chapter URL
  const chapterBaseUrl = partMatch ? `https://www.wattpad.com/${partMatch[1]}` : url;
  const { html, finalUrl } = await fetchHtml(chapterBaseUrl);

  if (storyMatch) {
    let storyTitle: string | null = null;
    let author: string | null = null;
    let coverUrl: string | null = null;
    let firstChapterUrl: string | null = null;

    // 1. Try window.__remixContext
    const remixMatch = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    if (remixMatch) {
      try {
        const remix = JSON.parse(remixMatch[1]);
        const loaderData = remix.state?.loaderData || {};
        for (const key of Object.keys(loaderData)) {
          const item = loaderData[key];
          if (item?.story) {
            storyTitle = item.story.title || null;
            author = item.story.user?.name || null;
            coverUrl = item.story.cover || null;
            if (Array.isArray(item.story.parts) && item.story.parts.length > 0) {
              const firstPart = item.story.parts[0];
              firstChapterUrl = firstPart.url
                ? resolveLink(firstPart.url, "https://www.wattpad.com")
                : (firstPart.id ? `https://www.wattpad.com/${firstPart.id}` : null);
            } else if (item.story.firstPartId) {
              firstChapterUrl = `https://www.wattpad.com/${item.story.firstPartId}`;
            }
            break;
          }
        }
      } catch {}
    }

    // 2. Fallback using DOM and JSON-LD
    const dom = new JSDOM(html, { url: finalUrl, virtualConsole: new VirtualConsole() });
    const doc = dom.window.document;

    if (!storyTitle || !author || !coverUrl) {
      const ldScript = doc.querySelector('script[type="application/ld+json"]');
      if (ldScript?.textContent) {
        try {
          const ld = JSON.parse(ldScript.textContent);
          if (!storyTitle) storyTitle = ld.name || ld.headline || null;
          if (!author) author = ld.author?.name || null;
          if (!coverUrl) coverUrl = ld.image || ld.thumbnailUrl || null;
        } catch {}
      }
    }

    if (!storyTitle) {
      storyTitle = firstText(doc, STORY_TITLE_SELECTORS) || doc.title.split(/[-|:]/)[0].trim() || null;
    }
    if (!coverUrl) {
      coverUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim() || null;
    }
    if (!firstChapterUrl) {
      for (const a of doc.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (href && /^\/\d+(?:-[^/]+)?$/i.test(href)) {
          firstChapterUrl = resolveLink(href, "https://www.wattpad.com");
          break;
        }
      }
    }

    return {
      url: finalUrl,
      storyTitle: storyTitle ? fixText(storyTitle) : null,
      chapterTitle: null,
      author: author ? fixText(author) : null,
      coverUrl,
      text: "",
      nextUrl: null,
      firstChapterUrl,
      isChapterUrl: false,
    };
  }

  if (partMatch) {
    const partId = partMatch[1];
    let storyTitle: string | null = null;
    let chapterTitle: string | null = null;
    let author: string | null = null;
    let coverUrl: string | null = null;
    let nextUrl: string | null = null;
    let canonicalPartUrl: string | null = null;
    let pages = 1;

    // 1. Try window.prefetched
    const prefetchedMatch = html.match(/window\.prefetched\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    if (prefetchedMatch) {
      try {
        const prefetched = JSON.parse(prefetchedMatch[1]);
        const partKey = Object.keys(prefetched).find((k) => k.startsWith(`part.${partId}`) || k.startsWith("part."));
        const partData = partKey ? prefetched[partKey]?.data : null;
        if (partData) {
          chapterTitle = partData.title || null;
          storyTitle = partData.group?.title || null;
          author = partData.group?.user?.name || null;
          coverUrl = partData.group?.cover || null;
          canonicalPartUrl = partData.url || null;
          pages = Math.max(Number(partData.pages) || 1, 1);

          if (partData.nextPart?.url) {
            nextUrl = resolveLink(partData.nextPart.url, "https://www.wattpad.com");
          } else if (partData.nextPart?.id) {
            nextUrl = `https://www.wattpad.com/${partData.nextPart.id}`;
          } else if (Array.isArray(partData.group?.parts)) {
            const idx = partData.group.parts.findIndex((p: { id: number | string }) => String(p.id) === String(partId));
            if (idx !== -1 && idx < partData.group.parts.length - 1) {
              const nextPart = partData.group.parts[idx + 1];
              nextUrl = nextPart.url ? resolveLink(nextPart.url, "https://www.wattpad.com") : `https://www.wattpad.com/${nextPart.id}`;
            }
          }
        }
      } catch {}
    }

    // 2. Fetch full text via Wattpad apiv2 (returns all pages of the chapter combined)
    let text = "";
    try {
      const apiRes = await fetch(`https://www.wattpad.com/apiv2/?m=storytext&id=${partId}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "vi-VN,vi;q=0.9,zh-CN,zh;q=0.8,en;q=0.7",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (apiRes.ok) {
        const apiHtml = await apiRes.text();
        if (apiHtml && apiHtml.length > 50) {
          const frag = JSDOM.fragment(apiHtml);
          frag.querySelectorAll('script, style, noscript, iframe, ins, [id^="ads"], [class^="ads"], [class*=" ads"]').forEach((el) => el.remove());
          text = cleanText(elementToText(frag));
        }
      }
    } catch {}

    // Fallback if apiv2 without page returned nothing and pages > 1
    if (!text && pages > 1) {
      const chunks: string[] = [];
      for (let p = 1; p <= pages; p++) {
        try {
          const pRes = await fetch(`https://www.wattpad.com/apiv2/?m=storytext&id=${partId}&page=${p}`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(15_000),
          });
          if (pRes.ok) {
            const pHtml = await pRes.text();
            const frag = JSDOM.fragment(pHtml);
            frag.querySelectorAll('script, style, noscript, iframe, ins, [id^="ads"], [class^="ads"], [class*=" ads"]').forEach((el) => el.remove());
            const cleaned = cleanText(elementToText(frag));
            if (cleaned) chunks.push(cleaned);
          }
        } catch {}
      }
      if (chunks.length > 0) {
        text = chunks.join("\n\n").trim();
      }
    }

    // Fallback from chapter HTML DOM if apiv2 didn't yield text
    const dom = new JSDOM(html, { url: finalUrl, virtualConsole: new VirtualConsole() });
    const doc = dom.window.document;

    if (!text || text.length < 100) {
      doc.querySelectorAll('script, style, noscript, iframe, ins, [id^="ads"], [class^="ads"], [class*=" ads"]').forEach((el) => el.remove());
      const pre = doc.querySelector("pre");
      if (pre) {
        text = cleanText(elementToText(pre));
      } else {
        const pEls = doc.querySelectorAll("p[data-p-id]");
        if (pEls.length > 0) {
          text = cleanText(Array.from(pEls).map((p) => p.textContent || "").join("\n\n"));
        }
      }
    }

    // Fallback for metadata if prefetched wasn't available
    if (!chapterTitle) {
      chapterTitle = doc.querySelector(".panel-reading h1, h1.h2, h1")?.textContent?.trim() || null;
    }
    if (!storyTitle) {
      storyTitle = doc.querySelector(".story-info .title a, .story-stats a")?.textContent?.trim() || doc.title.split(/[-|:]/)[0].trim() || null;
    }
    if (!author) {
      author = doc.querySelector(".author a, [itemprop=author]")?.textContent?.trim() || null;
    }
    if (!coverUrl) {
      coverUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim() || null;
    }
    if (!nextUrl) {
      // Find next chapter link in DOM, strictly avoiding /page/ links
      for (const a of doc.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href") || "";
        if (/\/page\/\d+/i.test(href)) continue;
        const label = `${a.textContent ?? ""} ${a.getAttribute("title") ?? ""}`.trim();
        if (/đọc phần tiếp theo|tiếp theo|chương sau|next part/i.test(label) && /^\/\d+/i.test(href)) {
          const resolved = resolveLink(href, "https://www.wattpad.com");
          if (resolved && !sameUrl(resolved, finalUrl)) {
            nextUrl = resolved;
            break;
          }
        }
      }
    }

    if (chapterTitle && storyTitle && chapterTitle.startsWith(storyTitle)) {
      chapterTitle = chapterTitle.slice(storyTitle.length).replace(/^\s*[-:|]\s*/, "").trim() || chapterTitle;
    }

    return {
      url: canonicalPartUrl || `https://www.wattpad.com/${partId}`,
      storyTitle: storyTitle ? fixText(storyTitle) : null,
      chapterTitle: chapterTitle ? fixText(chapterTitle) : null,
      author: author ? fixText(author) : null,
      coverUrl,
      text,
      nextUrl,
      firstChapterUrl: null,
      isChapterUrl: true,
    };
  }

  return parsePage(html, finalUrl);
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
  if (isWattpadUrl(url)) {
    return scrapeWattpad(url);
  }
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
    isChapterUrl: isWattpadUrl(url)
      ? /^\/\d+(?:-[^/]+)?(?:\/page\/\d+)?/i.test(decodeURI(new URL(url).pathname))
      : CHAPTER_NUMBER.test(decodeURI(new URL(url).pathname)),
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
  const isWattpad = isWattpadUrl(url);
  for (const selector of NEXT_SELECTORS) {
    for (const el of doc.querySelectorAll(selector)) {
      if (el.classList.contains("disabled")) continue;
      const href = el.getAttribute("href");
      if (isWattpad && href && /\/page\/\d+/i.test(href)) continue;
      const link = resolveLink(href, url);
      if (link && !sameUrl(link, url)) return link;
    }
  }
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (isWattpad && href && /\/page\/\d+/i.test(href)) continue;
    const label = `${a.textContent ?? ""} ${a.getAttribute("title") ?? ""}`.trim();
    if (!NEXT_TEXT.test(label)) continue;
    const link = resolveLink(href, url);
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
