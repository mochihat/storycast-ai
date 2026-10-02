// Listening progress is remembered in the browser (per device). Storage can be unavailable
// (private windows, blocked site data), so every access is wrapped.

const PREFIX = "storycast:";

function get(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function set(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // ignore
  }
}

export const readSetting = (name: string) => get(`setting:${name}`);
export const writeSetting = (name: string, value: string) => set(`setting:${name}`, value);

export const loadPosition = (chapterId: number) => Number(get(`pos:${chapterId}`)) || 0;
export const savePosition = (chapterId: number, seconds: number) => set(`pos:${chapterId}`, String(Math.floor(seconds)));

export const loadLastChapter = (storyId: number) => Number(get(`last:${storyId}`)) || null;
export const saveLastChapter = (storyId: number, chapterId: number) => set(`last:${storyId}`, String(chapterId));
