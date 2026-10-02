import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { Chapter, ChapterStatus, Story, StoryStatus } from "@/types";

// Everything lives on the local disk: one SQLite file + one folder of mp3s.
export const DATA_DIR = path.join(process.cwd(), "data");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");

const globalForDb = globalThis as unknown as { storycastDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "storycast.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      cover_url TEXT,
      source_url TEXT NOT NULL,
      next_url TEXT,
      target_chapters INTEGER NOT NULL DEFAULT 10,
      rate INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      title TEXT NOT NULL,
      source_url TEXT NOT NULL,
      text TEXT NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'fetched',
      error TEXT,
      audio_file TEXT,
      duration REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (story_id, idx)
    );
  `);
  return db;
}

export function db(): DatabaseSync {
  if (!globalForDb.storycastDb) globalForDb.storycastDb = open();
  return globalForDb.storycastDb;
}

// ---------- stories ----------

const STORY_COLUMNS = `
  s.*,
  (SELECT COUNT(*) FROM chapters c WHERE c.story_id = s.id) AS chapter_count,
  (SELECT COUNT(*) FROM chapters c WHERE c.story_id = s.id AND c.status = 'done') AS done_count,
  (SELECT COALESCE(SUM(duration), 0) FROM chapters c WHERE c.story_id = s.id AND c.status = 'done') AS total_duration
`;

export function listStories(): Story[] {
  return db()
    .prepare(`SELECT ${STORY_COLUMNS} FROM stories s ORDER BY s.updated_at DESC`)
    .all() as unknown as Story[];
}

export function getStory(id: number): Story | undefined {
  return db()
    .prepare(`SELECT ${STORY_COLUMNS} FROM stories s WHERE s.id = ?`)
    .get(id) as unknown as Story | undefined;
}

export function createStory(input: {
  title: string;
  author: string | null;
  cover_url: string | null;
  source_url: string;
  next_url: string | null;
  target_chapters: number;
  rate: number;
}): number {
  const result = db()
    .prepare(
      `INSERT INTO stories (title, author, cover_url, source_url, next_url, target_chapters, rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.title,
      input.author,
      input.cover_url,
      input.source_url,
      input.next_url,
      input.target_chapters,
      input.rate
    );
  return Number(result.lastInsertRowid);
}

export function updateStory(
  id: number,
  fields: Partial<
    Pick<Story, "title" | "author" | "cover_url" | "next_url" | "target_chapters" | "rate" | "status" | "error">
  >
) {
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k] ?? null);
  db()
    .prepare(`UPDATE stories SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values, id);
}

export function setStoryStatus(id: number, status: StoryStatus, error: string | null = null) {
  updateStory(id, { status, error });
}

export function deleteStory(id: number) {
  db().prepare(`DELETE FROM stories WHERE id = ?`).run(id);
  fs.rmSync(path.join(AUDIO_DIR, String(id)), { recursive: true, force: true });
}

export function storiesWithStatus(statuses: StoryStatus[]): number[] {
  const marks = statuses.map(() => "?").join(", ");
  return (
    db()
      .prepare(`SELECT id FROM stories WHERE status IN (${marks}) ORDER BY updated_at`)
      .all(...statuses) as { id: number }[]
  ).map((r) => r.id);
}

// ---------- chapters ----------

// The chapter list never ships the full text (it can be megabytes for a long book).
const CHAPTER_COLUMNS = `id, story_id, idx, title, source_url, char_count, status, error, audio_file, duration, created_at`;

export function listChapters(storyId: number): Chapter[] {
  return db()
    .prepare(`SELECT ${CHAPTER_COLUMNS} FROM chapters WHERE story_id = ? ORDER BY idx`)
    .all(storyId) as unknown as Chapter[];
}

export function getChapter(id: number): Chapter | undefined {
  return db()
    .prepare(`SELECT ${CHAPTER_COLUMNS} FROM chapters WHERE id = ?`)
    .get(id) as unknown as Chapter | undefined;
}

export function getChapterText(id: number): string {
  const row = db().prepare(`SELECT text FROM chapters WHERE id = ?`).get(id) as { text: string } | undefined;
  return row?.text ?? "";
}

export function countChapters(storyId: number): number {
  const row = db().prepare(`SELECT COUNT(*) AS n FROM chapters WHERE story_id = ?`).get(storyId) as { n: number };
  return row.n;
}

export function insertChapter(storyId: number, title: string, sourceUrl: string, text: string): number {
  const next = db()
    .prepare(`SELECT COALESCE(MAX(idx), 0) + 1 AS idx FROM chapters WHERE story_id = ?`)
    .get(storyId) as { idx: number };
  const result = db()
    .prepare(
      `INSERT INTO chapters (story_id, idx, title, source_url, text, char_count) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(storyId, next.idx, title, sourceUrl, text, text.length);
  return Number(result.lastInsertRowid);
}

export function hasChapterUrl(storyId: number, url: string): boolean {
  return !!db().prepare(`SELECT 1 FROM chapters WHERE story_id = ? AND source_url = ?`).get(storyId, url);
}

export function nextChapterToVoice(storyId: number): Chapter | undefined {
  return db()
    .prepare(`SELECT ${CHAPTER_COLUMNS} FROM chapters WHERE story_id = ? AND status = 'fetched' ORDER BY idx LIMIT 1`)
    .get(storyId) as unknown as Chapter | undefined;
}

export function setChapterStatus(id: number, status: ChapterStatus, error: string | null = null) {
  db().prepare(`UPDATE chapters SET status = ?, error = ? WHERE id = ?`).run(status, error, id);
}

export function setChapterAudio(id: number, audioFile: string, duration: number) {
  db()
    .prepare(`UPDATE chapters SET status = 'done', error = NULL, audio_file = ?, duration = ? WHERE id = ?`)
    .run(audioFile, duration, id);
}

// Put failed chapters (and chapters that were mid-way when the server stopped) back in line.
export function requeueChapters(storyId: number) {
  db()
    .prepare(`UPDATE chapters SET status = 'fetched', error = NULL WHERE story_id = ? AND status IN ('error', 'generating')`)
    .run(storyId);
}

export function resetChapterAudio(storyId: number) {
  db()
    .prepare(`UPDATE chapters SET status = 'fetched', error = NULL, audio_file = NULL, duration = NULL WHERE story_id = ?`)
    .run(storyId);
  fs.rmSync(path.join(AUDIO_DIR, String(storyId)), { recursive: true, force: true });
}
