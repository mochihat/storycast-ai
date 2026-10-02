import { createStory, insertChapter, listStories } from "@/lib/db";
import { scrapePage } from "@/lib/scraper";
import { enqueue, ensureWorker } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureWorker();
  return Response.json(listStories());
}

export async function POST(request: Request) {
  ensureWorker();
  const body = (await request.json().catch(() => ({}))) as { url?: string; chapters?: number; rate?: number };

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
    const overview = page;
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

    const id = createStory({
      title: overview.storyTitle || page.storyTitle || "Truyện không tên",
      author: overview.author || page.author,
      cover_url: overview.coverUrl || page.coverUrl,
      source_url: url.toString(),
      next_url: page.nextUrl,
      target_chapters: target,
      rate,
    });
    insertChapter(id, page.chapterTitle || "Chương 1", page.url, page.text);
    enqueue(id);
    return Response.json({ id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
