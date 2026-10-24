import "server-only";

import { convertToVietnamese } from "./convert";

// "convert": VietPhrase dictionaries with names in Hán Việt, the style of Vietnamese convert sites.
// "google": Google Translate, smoother sentences but names come out in pinyin.
export type Translator = "convert" | "google";

// Google's free translate endpoint used by the Chrome dictionary extension: no API key, keeps line breaks.
// (The better-known translate.googleapis.com "gtx" endpoint rate-limits servers much sooner.)
const ENDPOINT = "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=vi";

// Long requests get cut off; a few thousand characters per request is safe.
const MAX_CHUNK = 4000;

export function isChinese(text: string): boolean {
  const sample = text.slice(0, 3000);
  const cjk = sample.match(/[一-鿿㐀-䶿]/g)?.length ?? 0;
  return cjk > 15 || (sample.length > 0 && cjk / sample.length > 0.1);
}

function splitParagraphs(text: string, max = MAX_CHUNK): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && current.length + line.length + 1 > max) {
      chunks.push(current);
      current = "";
    }
    // A single paragraph longer than a request: cut at sentence ends.
    if (line.length > max) {
      for (const sentence of line.match(/[^。！？；!?]+[。！？；!?」』”]*/g) ?? [line]) {
        if (current.length + sentence.length > max && current) {
          chunks.push(current);
          current = "";
        }
        current += sentence;
      }
      current += "\n";
      continue;
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translateChunk(text: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ q: text }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Google Dịch trả về lỗi ${res.status}`);
      // Response: [["bản dịch", "zh-CN"]] (or ["bản dịch"] when the source language is given).
      const json = (await res.json()) as unknown[];
      const first = json[0];
      const translated = Array.isArray(first) ? first[0] : first;
      if (typeof translated !== "string") throw new Error("Google Dịch trả về dữ liệu lạ");
      return translated;
    } catch (err) {
      lastError = err;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`Không dịch được: ${lastError instanceof Error ? lastError.message : lastError}`);
}

// Translates Chinese text to Vietnamese, paragraph by paragraph. Non-Chinese text is returned unchanged.
export async function translateToVietnamese(text: string): Promise<string> {
  if (!text.trim() || !isChinese(text)) return text;
  const parts: string[] = [];
  for (const chunk of splitParagraphs(text)) {
    parts.push(await translateChunk(chunk));
    // Be gentle with the free endpoint.
    await sleep(300);
  }
  return parts
    .join("\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

// Short metadata (story title, author) that may or may not be Chinese.
export async function translateShort(text: string | null): Promise<string | null> {
  if (!text || !/[一-鿿㐀-䶿]/.test(text)) return text;
  try {
    return (await translateChunk(text)).trim() || text;
  } catch {
    return text;
  }
}

// Translates a whole chapter (or a title) with the story's chosen translator. Non-Chinese text is left alone.
export async function translateText(text: string, translator: Translator): Promise<string> {
  if (!/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return text;
  if (translator === "convert") return convertToVietnamese(text);
  return text.length < 200 ? ((await translateShort(text)) ?? text) : translateToVietnamese(text);
}
