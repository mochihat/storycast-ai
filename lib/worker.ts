import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  AUDIO_DIR,
  getChapterText,
  getStory,
  hasChapterUrl,
  insertChapter,
  nextChapterToVoice,
  requeueChapters,
  setChapterAudio,
  setChapterStatus,
  setStoryStatus,
  storiesWithStatus,
  updateStory,
} from "./db";
import { scrapePage } from "./scraper";
import { StoppedError, synthesize } from "./tts";
import type { Chapter } from "@/types";

// One background loop per server process, working through stories one at a time.
// Kept on globalThis so hot reloads in dev don't start a second loop.
interface WorkerState {
  started: boolean;
  running: boolean;
  queue: number[];
  current: number | null;
  stopRequested: Set<number>;
}

const g = globalThis as unknown as { storycastWorker?: WorkerState };
const state: WorkerState = (g.storycastWorker ??= {
  started: false,
  running: false,
  queue: [],
  current: null,
  stopRequested: new Set(),
});

// Pick up work that was interrupted when the server last stopped.
export function ensureWorker() {
  if (state.started) return;
  state.started = true;
  for (const id of storiesWithStatus(["queued", "running"])) {
    requeueChapters(id);
    enqueue(id);
  }
}

export function enqueue(storyId: number) {
  state.stopRequested.delete(storyId);
  if (state.current === storyId) {
    setStoryStatus(storyId, "running");
  } else if (!state.queue.includes(storyId)) {
    state.queue.push(storyId);
    setStoryStatus(storyId, "queued");
  }
  void run();
}

export function stop(storyId: number) {
  state.queue = state.queue.filter((id) => id !== storyId);
  if (state.current === storyId) state.stopRequested.add(storyId);
  setStoryStatus(storyId, "paused");
}

export function isBusy(storyId: number) {
  return state.current === storyId;
}

async function run() {
  if (state.running) return;
  state.running = true;
  try {
    while (state.queue.length > 0) {
      const storyId = state.queue.shift()!;
      state.current = storyId;
      try {
        await processStory(storyId);
      } catch (err) {
        if (getStory(storyId) && !state.stopRequested.has(storyId)) {
          setStoryStatus(storyId, "error", err instanceof Error ? err.message : String(err));
        }
      } finally {
        state.current = null;
        state.stopRequested.delete(storyId);
      }
    }
  } finally {
    state.running = false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function processStory(storyId: number) {
  if (!getStory(storyId)) return;
  setStoryStatus(storyId, "running");

  while (true) {
    if (state.stopRequested.has(storyId)) return;
    const story = getStory(storyId);
    if (!story) return;

    // Voice every chapter we already have before fetching more, so listening can start early.
    const chapter = nextChapterToVoice(storyId);
    if (chapter) {
      await voiceChapter(chapter, story.rate);
      continue;
    }

    if (story.chapter_count >= story.target_chapters || !story.next_url) break;

    const page = await scrapePage(story.next_url);
    if (page.text.length < 50) {
      throw new Error(`Không tìm thấy nội dung chương ở ${story.next_url}`);
    }
    if (hasChapterUrl(storyId, page.url)) {
      // The "next" link led back to a chapter we already have: this is the end of the story.
      updateStory(storyId, { next_url: null });
      break;
    }
    insertChapter(storyId, page.chapterTitle || `Chương ${story.chapter_count + 1}`, page.url, page.text);
    updateStory(storyId, { next_url: page.nextUrl });
    // Be gentle with the story site.
    await sleep(800);
  }

  setStoryStatus(storyId, "done");
}

async function voiceChapter(chapter: Chapter, rate: number) {
  setChapterStatus(chapter.id, "generating");
  const text = `${chapter.title}.\n${getChapterText(chapter.id)}`;
  try {
    const { audio, duration } = await synthesize(text, rate, () => state.stopRequested.has(chapter.story_id));
    if (!getStory(chapter.story_id)) return; // deleted while we were reading it
    const relative = path.join(String(chapter.story_id), `${chapter.id}.mp3`);
    fs.mkdirSync(path.join(AUDIO_DIR, String(chapter.story_id)), { recursive: true });
    fs.writeFileSync(path.join(AUDIO_DIR, relative), audio);
    setChapterAudio(chapter.id, relative, duration);
  } catch (err) {
    if (err instanceof StoppedError) {
      setChapterStatus(chapter.id, "fetched");
      return;
    }
    setChapterStatus(chapter.id, "error", err instanceof Error ? err.message : String(err));
  }
}
