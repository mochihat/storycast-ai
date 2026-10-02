// queued: waiting for the worker · running: fetching text / generating audio
// done: reached the target chapter count (or the last chapter of the story)
// paused: stopped by the user · error: could not fetch the next chapter
export type StoryStatus = "queued" | "running" | "done" | "paused" | "error";

// fetched: text saved, waiting for its voice · generating: the AI voice is reading it
export type ChapterStatus = "fetched" | "generating" | "done" | "error";

export interface Story {
  id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  source_url: string;
  next_url: string | null;
  target_chapters: number;
  // Reading speed in percent relative to normal, e.g. -10 or +20.
  rate: number;
  status: StoryStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  done_count: number;
  total_duration: number;
}

export interface Chapter {
  id: number;
  story_id: number;
  idx: number;
  title: string;
  source_url: string;
  char_count: number;
  status: ChapterStatus;
  error: string | null;
  audio_file: string | null;
  duration: number | null;
  created_at: string;
}

export interface StoryWithChapters extends Story {
  chapters: Chapter[];
  ffmpeg: boolean;
}
