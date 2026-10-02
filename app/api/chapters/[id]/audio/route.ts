import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { safeFileName } from "@/lib/book";
import { AUDIO_DIR, getChapter, getStory } from "@/lib/db";

export const dynamic = "force-dynamic";

// Streams a chapter's mp3. Supports Range requests so the player can seek.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const chapter = getChapter(Number((await ctx.params).id));
  if (!chapter?.audio_file) return new Response("Chưa có audio", { status: 404 });

  const file = path.join(AUDIO_DIR, chapter.audio_file);
  if (!fs.existsSync(file)) return new Response("Không tìm thấy file audio", { status: 404 });
  const size = fs.statSync(file).size;

  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  if (new URL(request.url).searchParams.has("download")) {
    const story = getStory(chapter.story_id);
    const name = `${safeFileName(story?.title ?? "truyen")} - ${String(chapter.idx).padStart(3, "0")} ${safeFileName(chapter.title)}.mp3`;
    headers["Content-Disposition"] = `attachment; filename="chapter.mp3"; filename*=UTF-8''${encodeURIComponent(name)}`;
  }

  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    let start = range[1] ? Number(range[1]) : 0;
    let end = range[2] ? Number(range[2]) : size - 1;
    if (!range[1] && range[2]) {
      start = Math.max(size - Number(range[2]), 0);
      end = size - 1;
    }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
