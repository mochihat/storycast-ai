import { getChapter, getChapterText } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const chapter = getChapter(Number((await ctx.params).id));
  if (!chapter) return Response.json({ error: "Không tìm thấy chương" }, { status: 404 });
  return Response.json({ title: chapter.title, text: getChapterText(chapter.id) });
}
