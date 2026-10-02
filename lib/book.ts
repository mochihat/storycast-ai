import "server-only";

import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { AUDIO_DIR, listChapters } from "./db";
import type { Story } from "@/types";

const run = promisify(execFile);

let ffmpegChecked: boolean | undefined;

export function hasFfmpeg(): boolean {
  if (ffmpegChecked === undefined) {
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
      ffmpegChecked = true;
    } catch {
      ffmpegChecked = false;
    }
  }
  return ffmpegChecked;
}

function escapeMeta(value: string) {
  return value.replace(/([=;#\\\n])/g, "\\$1");
}

// Builds one audiobook file (.m4b) with a chapter marker per chapter, so audiobook
// players show the table of contents. Cached until the set of finished chapters changes.
export async function buildBook(story: Story): Promise<string> {
  const chapters = listChapters(story.id).filter((c) => c.status === "done" && c.audio_file);
  if (chapters.length === 0) throw new Error("Truyện chưa có chương nào có audio");

  const dir = path.join(AUDIO_DIR, String(story.id));
  const key = `${chapters.length}-${chapters[chapters.length - 1].id}`;
  const output = path.join(dir, `book-${key}.m4b`);
  if (fs.existsSync(output)) return output;

  for (const old of fs.readdirSync(dir).filter((f) => f.startsWith("book-"))) {
    fs.rmSync(path.join(dir, old), { force: true });
  }

  const list = chapters.map((c) => `file '${path.join(AUDIO_DIR, c.audio_file!).replace(/'/g, "'\\''")}'`).join("\n");
  const listFile = path.join(dir, "concat.txt");
  fs.writeFileSync(listFile, list);

  let start = 0;
  const meta = [";FFMETADATA1", `title=${escapeMeta(story.title)}`, `album=${escapeMeta(story.title)}`, "genre=Audiobook"];
  if (story.author) meta.push(`artist=${escapeMeta(story.author)}`);
  for (const c of chapters) {
    const end = start + Math.round((c.duration ?? 0) * 1000);
    meta.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${start}`, `END=${end}`, `title=${escapeMeta(c.title)}`);
    start = end;
  }
  const metaFile = path.join(dir, "chapters.txt");
  fs.writeFileSync(metaFile, meta.join("\n"));

  const tmp = `${output}.tmp.m4b`;
  try {
    await run(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", listFile,
        "-i", metaFile, "-map_metadata", "1", "-map_chapters", "1",
        "-map", "0:a", "-c:a", "aac", "-b:a", "64k", "-ac", "1",
        "-movflags", "+faststart",
        tmp,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    fs.renameSync(tmp, output);
  } finally {
    fs.rmSync(tmp, { force: true });
    fs.rmSync(listFile, { force: true });
    fs.rmSync(metaFile, { force: true });
  }
  return output;
}

export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "truyen";
}
