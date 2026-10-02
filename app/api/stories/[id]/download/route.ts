import fs from "node:fs";
import { Readable } from "node:stream";

import { buildBook, hasFfmpeg, safeFileName } from "@/lib/book";
import { getStory } from "@/lib/db";

export const dynamic = "force-dynamic";

// Downloads the whole story as one audiobook file with chapter markers.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const story = getStory(Number((await ctx.params).id));
  if (!story) return Response.json({ error: "Không tìm thấy truyện" }, { status: 404 });
  if (!hasFfmpeg()) {
    return Response.json({ error: "Cần cài ffmpeg để ghép cả quyển (sudo apt install ffmpeg)." }, { status: 501 });
  }

  try {
    const file = await buildBook(story);
    const name = `${safeFileName(story.title)}.m4b`;
    return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Length": String(fs.statSync(file).size),
        "Content-Disposition": `attachment; filename="book.m4b"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
