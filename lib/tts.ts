import "server-only";

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Microsoft Edge's free neural voice: Vietnamese, female.
export const VOICE = "vi-VN-HoaiMyNeural";
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
const BYTES_PER_SECOND = 48_000 / 8;

// Edge closes the socket on very long requests; a few thousand characters per request is safe.
const MAX_CHUNK = 2500;

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function splitText(text: string, max = MAX_CHUNK): string[] {
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const paragraph of text.split("\n")) {
    if (current.length + paragraph.length + 1 <= max) {
      current += paragraph + "\n";
      continue;
    }
    push();
    if (paragraph.length <= max) {
      current = paragraph + "\n";
      continue;
    }
    // A single huge paragraph: cut at sentence ends, then at spaces.
    for (const sentence of paragraph.match(/[^.!?…]+[.!?…]*\s*/g) ?? [paragraph]) {
      if (current.length + sentence.length > max) push();
      if (sentence.length > max) {
        for (let i = 0; i < sentence.length; i += max) chunks.push(sentence.slice(i, i + max));
      } else {
        current += sentence;
      }
    }
  }
  push();
  return chunks;
}

async function synthesizeChunk(tts: MsEdgeTTS, text: string, rate: number): Promise<Buffer> {
  const { audioStream } = tts.toStream(escapeXml(text), { rate: `${rate >= 0 ? "+" : ""}${rate}%` });
  const parts: Buffer[] = [];
  for await (const part of audioStream) parts.push(part as Buffer);
  const audio = Buffer.concat(parts);
  if (audio.length === 0) throw new Error("Giọng đọc không trả về âm thanh");
  return audio;
}

async function connect(): Promise<MsEdgeTTS> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, FORMAT);
  return tts;
}

// Edge reads a chunk at about 6x real time; reading a few chunks at once makes a chapter ~3x faster.
const PARALLEL = 3;

// Reads the whole text with the AI voice and returns one mp3 (mp3 frames can simply be concatenated).
export async function synthesize(
  text: string,
  rate: number,
  shouldStop: () => boolean = () => false
): Promise<{ audio: Buffer; duration: number }> {
  const chunks = splitText(text);
  const parts: Buffer[] = new Array(chunks.length);
  let nextChunk = 0;

  const worker = async () => {
    let tts = await connect();
    try {
      while (nextChunk < chunks.length) {
        const i = nextChunk++;
        let lastError: unknown;
        for (let attempt = 0; attempt < 4; attempt++) {
          if (shouldStop()) throw new StoppedError();
          try {
            parts[i] = await synthesizeChunk(tts, chunks[i], rate);
            lastError = undefined;
            break;
          } catch (err) {
            lastError = err;
            tts.close();
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            tts = await connect();
          }
        }
        if (lastError) throw lastError;
      }
    } finally {
      tts.close();
    }
  };

  // If one reader fails, stop the others from starting new chunks.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(PARALLEL, chunks.length) }, () =>
      worker().catch((err) => {
        nextChunk = chunks.length;
        throw err;
      })
    )
  );
  const failure = results.find((r) => r.status === "rejected");
  if (failure) throw (failure as PromiseRejectedResult).reason;

  const audio = Buffer.concat(parts);
  return { audio, duration: audio.length / BYTES_PER_SECOND };
}

export class StoppedError extends Error {
  constructor() {
    super("Đã dừng");
  }
}
