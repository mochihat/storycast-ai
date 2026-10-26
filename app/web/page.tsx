"use client";

import { use, useRef, useState } from "react";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

type Lang = "vi" | "zh";
type Mode = Lang | "both";

const MODES: [Mode, string][] = [
  ["vi", "Tiếng Việt"],
  ["zh", "Tiếng Trung"],
  ["both", "Song song"],
];

const proxy = (target: string, lang: Lang) =>
  `/api/web?url=${encodeURIComponent(target)}${lang === "zh" ? "&lang=zh" : ""}`;
const shown = (mode: Mode): Lang[] => (mode === "both" ? ["vi", "zh"] : [mode]);

export default function WebReader({ searchParams }: { searchParams: Promise<{ url?: string; mode?: string }> }) {
  const params = use(searchParams);
  const initial = params.url ?? "";
  const [url, setUrl] = useState(initial);
  const [mode, setMode] = useState<Mode>(MODES.find(([value]) => value === params.mode)?.[0] ?? "vi");
  const [srcs, setSrcs] = useState<Record<Lang, string>>({
    vi: initial ? proxy(initial, "vi") : "",
    zh: initial ? proxy(initial, "zh") : "",
  });
  // The page the reader is on now: links clicked inside a pane move it without the input knowing.
  // Kept in a ref for the load handlers and in state for rendering.
  const target = useRef(initial);
  const [page, setPage] = useState(initial);

  const open = (next: string) => {
    target.current = next;
    setPage(next);
    setSrcs({ vi: proxy(next, "vi"), zh: proxy(next, "zh") });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    open(url.trim());
  };

  // Panes that become visible open the current page; panes already showing are left alone (no reload).
  const switchMode = (next: Mode) => {
    if (target.current) {
      const adding = shown(next).filter((lang) => !shown(mode).includes(lang));
      setSrcs((prev) => ({ ...prev, ...Object.fromEntries(adding.map((lang) => [lang, proxy(target.current, lang)])) }));
    }
    setMode(next);
  };

  // A link was followed in one pane: remember the page and, side by side, take the other pane there too.
  const onLoad = (lang: Lang, frame: HTMLIFrameElement) => {
    let next: string | null = null;
    try {
      next = new URL(frame.contentWindow?.location.href ?? "").searchParams.get("url");
    } catch {
      return;
    }
    if (!next || next === target.current) return;
    target.current = next;
    setPage(next);
    setUrl(next);
    const other: Lang = lang === "vi" ? "zh" : "vi";
    setSrcs((prev) => ({ ...prev, [other]: proxy(next, other) }));
  };

  const hasPage = Boolean(srcs.vi);

  return (
    <div className="bg-neutral-900 md:rounded-lg h-full w-full flex flex-col">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2 px-4 pt-4 md:px-6">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán link bất kỳ trang nào của web truyện tiếng Trung"
          className="min-w-0 flex-1 rounded-md bg-neutral-700 px-3 py-2.5 text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="rounded-full bg-emerald-500 px-6 py-2.5 font-semibold text-black hover:bg-emerald-400 transition"
        >
          Dịch trang
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <div className="flex rounded-full bg-neutral-800 p-1" role="radiogroup" aria-label="Ngôn ngữ hiển thị">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => switchMode(value)}
              className={twMerge(
                "rounded-full px-4 py-1.5 text-sm font-medium text-neutral-300 hover:text-white transition",
                mode === value && "bg-emerald-500 text-black hover:text-black"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {hasPage && (
          <a
            href={proxy(page, mode === "zh" ? "zh" : "vi")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-x-1 px-2 text-sm text-neutral-400 hover:text-white"
          >
            <HiArrowTopRightOnSquare size={16} /> Mở tab mới
          </a>
        )}
      </div>

      {hasPage ? (
        <div className={twMerge("flex-1 min-h-0 grid gap-1", mode === "both" && "md:grid-cols-2")}>
          {shown(mode).map((lang) => (
            // No allow-scripts: the translated page is plain HTML, and nothing from the site may run here.
            <iframe
              key={lang}
              src={srcs[lang]}
              onLoad={(e) => onLoad(lang, e.currentTarget)}
              title={lang === "vi" ? "Trang tiếng Việt" : "Trang gốc tiếng Trung"}
              sandbox="allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
              className="h-full min-h-[60vh] w-full bg-white md:rounded-b-lg"
            />
          ))}
        </div>
      ) : (
        <p className="px-6 text-neutral-400">
          Dán link trang chủ, trang truyện, bảng xếp hạng hay một chương của web truyện tiếng Trung. Cả trang sẽ được convert
          sang tiếng Việt (tên đọc Hán Việt), và bấm vào link nào trong trang cũng tiếp tục được dịch. Chọn{" "}
          <b>Tiếng Trung</b> để xem bản gốc, hoặc <b>Song song</b> để xem hai bản cạnh nhau.
        </p>
      )}
    </div>
  );
}
