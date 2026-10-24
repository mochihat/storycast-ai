import { createStory, insertChapter, listStories } from "@/lib/db";
import { isPo18Url, scrapePage } from "@/lib/scraper";
import { isChinese, translateText, type Translator } from "@/lib/translate";
import { enqueue, ensureWorker } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureWorker();
  return Response.json(listStories());
}

export async function POST(request: Request) {
  ensureWorker();
  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    chapters?: number;
    rate?: number;
    // "convert" (default) or "google"; "none" keeps the original text.
    translator?: Translator | "none";
  };

  let url: URL;
  try {
    url = new URL(String(body.url ?? "").trim());
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return Response.json({ error: "Link không hợp lệ. Hãy dán link bắt đầu bằng http:// hoặc https://" }, { status: 400 });
  }
  const target = Math.min(Math.max(Math.round(Number(body.chapters) || 10), 1), 2000);
  const rate = Math.min(Math.max(Math.round(Number(body.rate) || 0), -50), 100);

  try {
    let page = await scrapePage(url.toString());
    let overview = page;
    // A PO18 chapter page has no cover: read it from the book's chapter list instead.
    const po18Book = isPo18Url(url.toString()) && url.pathname.match(/^\/books\/\d+/)?.[0];
    if (po18Book && page.isChapterUrl && !page.coverUrl) {
      overview = await scrapePage(new URL(po18Book, url).toString()).catch(() => page);
    }
    // A link to the story's overview page: start from its first chapter.
    if (page.firstChapterUrl && (!page.isChapterUrl || page.text.length < 300)) {
      page = await scrapePage(page.firstChapterUrl);
    }
    if (page.text.length < 200) {
      return Response.json(
        { error: "Không tìm thấy nội dung truyện ở link này. Hãy thử dán link của một chương cụ thể." },
        { status: 422 }
      );
    }

    // Only Chinese stories get translated; for anything else the option does nothing.
    const translator: Translator | null =
      body.translator === "none" || !isChinese(page.text) ? null : body.translator === "google" ? "google" : "convert";
    let title = overview.storyTitle || page.storyTitle || "Truyện không tên";
    // Pen names are kept as-is: translating them word by word gives nonsense ("青涩" → "trẻ trung").
    const author = overview.author || page.author;
    let chapterTitle = page.chapterTitle || "Chương 1";
    let text = page.text;
    if (translator) {
      title = await translateText(title, translator);
      chapterTitle = await translateText(chapterTitle, translator);
      text = await translateText(text, translator);
    }

    const id = createStory({
      title,
      author,
      cover_url: overview.coverUrl || page.coverUrl,
      source_url: url.toString(),
      next_url: page.nextUrl,
      target_chapters: target,
      rate,
      translator,
    });
    insertChapter(id, chapterTitle, page.url, text);
    enqueue(id);
    return Response.json({ id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
