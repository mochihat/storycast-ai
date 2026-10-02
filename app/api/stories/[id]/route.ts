import { deleteStory, getStory, listChapters, requeueChapters, resetChapterAudio, updateStory } from "@/lib/db";
import { hasFfmpeg } from "@/lib/book";
import { enqueue, ensureWorker, isBusy, stop } from "@/lib/worker";
import type { StoryWithChapters } from "@/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findStory(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? getStory(id) : undefined;
}

const notFound = () => Response.json({ error: "Không tìm thấy truyện" }, { status: 404 });

export async function GET(_req: Request, ctx: Ctx) {
  ensureWorker();
  const story = await findStory(ctx);
  if (!story) return notFound();
  const result: StoryWithChapters = { ...story, chapters: listChapters(story.id), ffmpeg: hasFfmpeg() };
  return Response.json(result);
}

// Actions from the story page: get more chapters, pause/resume, retry failures, change voice speed or title.
export async function PATCH(request: Request, ctx: Ctx) {
  ensureWorker();
  const story = await findStory(ctx);
  if (!story) return notFound();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "more" | "pause" | "resume" | "retry" | "revoice";
    count?: number;
    rate?: number;
    title?: string;
  };

  if (typeof body.title === "string" && body.title.trim()) {
    updateStory(story.id, { title: body.title.trim().slice(0, 200) });
  }
  if (typeof body.rate === "number") {
    updateStory(story.id, { rate: Math.min(Math.max(Math.round(body.rate), -50), 100) });
  }

  switch (body.action) {
    case "more": {
      const count = Math.min(Math.max(Math.round(Number(body.count) || 10), 1), 2000);
      if (!story.next_url) {
        return Response.json({ error: "Đã lấy hết các chương của truyện này rồi." }, { status: 400 });
      }
      updateStory(story.id, { target_chapters: story.chapter_count + count });
      enqueue(story.id);
      break;
    }
    case "pause":
      stop(story.id);
      break;
    case "resume":
    case "retry":
      if (!isBusy(story.id)) requeueChapters(story.id);
      enqueue(story.id);
      break;
    case "revoice":
      // Read every chapter again, e.g. after changing the speed.
      if (isBusy(story.id)) {
        return Response.json({ error: "Hãy bấm Dừng trước, rồi đọc lại." }, { status: 409 });
      }
      resetChapterAudio(story.id);
      enqueue(story.id);
      break;
  }
  return Response.json(getStory(story.id));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const story = await findStory(ctx);
  if (!story) return notFound();
  stop(story.id);
  deleteStory(story.id);
  return Response.json({ ok: true });
}
