"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { HiArrowDownTray, HiArrowPath, HiDocumentText, HiTrash, HiXMark } from "react-icons/hi2";
import { ClipLoader } from "react-spinners";

import Cover from "@/components/Cover";
import StatusBadge from "@/components/StatusBadge";
import usePlayer, { type Track } from "@/hooks/usePlayer";
import { usePolling } from "@/hooks/usePolling";
import { formatDuration, formatLength, formatRate } from "@/lib/format";
import { loadLastChapter } from "@/lib/progress";
import type { Chapter, StoryWithChapters } from "@/types";

const CHAPTER_STATUS: Record<Chapter["status"], string> = {
  fetched: "Chờ đọc",
  generating: "Đang đọc…",
  done: "",
  error: "Lỗi",
};

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const player = usePlayer();
  const { data: story, error, refresh } = usePolling<StoryWithChapters>(`/api/stories/${id}`, 3000);
  const [moreCount, setMoreCount] = useState(20);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reading, setReading] = useState<{ title: string; text: string } | null>(null);

  if (error && !story) {
    return (
      <div className="p-6 text-neutral-300">
        {error}{" "}
        <Link href="/" className="text-emerald-400 underline">
          Về thư viện
        </Link>
      </div>
    );
  }
  if (!story) {
    return (
      <div className="flex h-full items-center justify-center">
        <ClipLoader color="#10b981" />
      </div>
    );
  }

  const tracks: Track[] = story.chapters
    .filter((c) => c.status === "done")
    .map((c) => ({
      chapterId: c.id,
      storyId: story.id,
      title: c.title,
      storyTitle: story.title,
      cover: story.cover_url,
    }));
  const working = story.status === "running" || story.status === "queued";
  const failed = story.chapters.filter((c) => c.status === "error").length;
  const playingId = player.tracks[player.index]?.chapterId;

  const playChapter = (chapterId: number) => {
    const at = tracks.findIndex((t) => t.chapterId === chapterId);
    if (at >= 0) player.play(tracks, at);
  };

  const listen = () => {
    const last = loadLastChapter(story.id);
    const at = tracks.findIndex((t) => t.chapterId === last);
    player.play(tracks, Math.max(at, 0));
  };

  const act = async (body: Record<string, unknown>, success?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Có lỗi xảy ra");
      if (success) toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Xóa truyện “${story.title}” và toàn bộ audio của nó?`)) return;
    await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    if (player.tracks[0]?.storyId === story.id) player.reset();
    toast.success("Đã xóa truyện");
    router.push("/");
  };

  // Building the .m4b can take a while for long books, so fetch it here and show a spinner.
  const downloadBook = async () => {
    setDownloading(true);
    const toastId = toast.loading("Đang ghép cả quyển… (có thể mất vài phút)");
    try {
      const res = await fetch(`/api/stories/${story.id}/download`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Không tải được");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${story.title}.m4b`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Đã tải xong", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const showText = async (chapter: Chapter) => {
    const res = await fetch(`/api/chapters/${chapter.id}/text`);
    if (res.ok) setReading(await res.json());
  };

  const progress = story.target_chapters
    ? Math.min(story.done_count / Math.max(story.target_chapters, story.chapter_count), 1)
    : 0;

  return (
    <div className="bg-neutral-900 md:rounded-lg min-h-full w-full">
      <div className="bg-linear-to-b from-emerald-800 px-6 pt-8 pb-6 md:rounded-t-lg">
        <div className="flex flex-col sm:flex-row gap-6 sm:items-end">
          <Cover src={story.cover_url} alt={story.title} className="h-48 w-36 shadow-xl" />
          <div className="min-w-0 flex-1">
            <StatusBadge status={story.status} />
            <h1 className="mt-2 text-white text-3xl font-bold break-words">{story.title}</h1>
            {story.author && <p className="mt-1 text-neutral-200">{story.author}</p>}
            <p className="mt-2 text-sm text-neutral-300">
              {story.done_count}/{story.chapter_count} chương có audio · {formatLength(story.total_duration)} · tốc độ
              giọng {formatRate(story.rate)} ·{" "}
              <a href={story.source_url} target="_blank" rel="noreferrer" className="underline hover:text-white">
                nguồn
              </a>
            </p>
            {working && (
              <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-neutral-700">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {story.status === "error" && story.error && <p className="mt-2 text-sm text-red-300">Lỗi: {story.error}</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={listen}
            disabled={tracks.length === 0}
            className="inline-flex items-center gap-x-2 rounded-full bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
          >
            <BsPlayFill size={22} /> {loadLastChapter(story.id) ? "Nghe tiếp" : "Nghe"}
          </button>

          {working ? (
            <button onClick={() => act({ action: "pause" })} disabled={busy} className="btn-secondary">
              <BsPauseFill size={18} /> Dừng tạo audio
            </button>
          ) : (
            (story.status === "paused" || story.status === "error") && (
              <button onClick={() => act({ action: "resume" })} disabled={busy} className="btn-secondary">
                <HiArrowPath size={18} /> Tiếp tục
              </button>
            )
          )}

          {failed > 0 && !working && (
            <button
              onClick={() => act({ action: "retry" }, "Đang thử lại các chương lỗi")}
              disabled={busy}
              className="btn-secondary"
            >
              <HiArrowPath size={18} /> Thử lại {failed} chương lỗi
            </button>
          )}

          <button
            onClick={downloadBook}
            disabled={downloading || tracks.length === 0 || !story.ffmpeg}
            className="btn-secondary"
            title={story.ffmpeg ? "" : "Cần cài ffmpeg"}
          >
            <HiArrowDownTray size={18} /> {downloading ? "Đang ghép…" : "Tải cả quyển (.m4b)"}
          </button>

          <button onClick={remove} className="btn-secondary hover:!border-red-400 hover:!text-red-300">
            <HiTrash size={18} /> Xóa
          </button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-wrap items-end gap-6 border-b border-neutral-800">
        {story.next_url ? (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-y-1 text-sm text-neutral-400">
              Lấy thêm chương
              <input
                type="number"
                min={1}
                max={2000}
                value={moreCount}
                onChange={(e) => setMoreCount(Number(e.target.value))}
                className="w-24 rounded-md bg-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <button
              onClick={() => act({ action: "more", count: moreCount }, `Đang lấy thêm ${moreCount} chương`)}
              disabled={busy}
              className="btn-secondary"
            >
              Lấy thêm
            </button>
          </div>
        ) : (
          !working && <p className="text-sm text-neutral-400">Đã lấy tới chương cuối cùng của truyện.</p>
        )}

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-y-1 text-sm text-neutral-400">
            Tốc độ giọng đọc (cho chương mới)
            <select
              value={story.rate}
              onChange={(e) => act({ rate: Number(e.target.value) }, "Đã đổi tốc độ cho các chương tạo sau")}
              className="rounded-md bg-neutral-700 px-3 py-2 text-white"
            >
              {[-30, -20, -10, 0, 10, 20, 30, 40, 50].map((r) => (
                <option key={r} value={r}>
                  {formatRate(r)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              if (confirm("Đọc lại tất cả các chương với tốc độ hiện tại? Audio cũ sẽ bị xóa.")) {
                void act({ action: "revoice" }, "Đang đọc lại tất cả các chương");
              }
            }}
            disabled={busy || working}
            className="btn-secondary"
            title={working ? "Hãy dừng trước" : ""}
          >
            Đọc lại tất cả
          </button>
        </div>
      </div>

      <ol className="px-2 md:px-4 py-3">
        {story.chapters.map((chapter) => {
          const isPlaying = chapter.id === playingId;
          return (
            <li
              key={chapter.id}
              className={`group flex items-center gap-x-3 rounded-md px-3 py-2.5 hover:bg-neutral-800/60 ${isPlaying ? "bg-neutral-800" : ""}`}
            >
              <span className="w-8 text-right text-sm tabular-nums text-neutral-500">{chapter.idx}</span>
              <button
                onClick={() => playChapter(chapter.id)}
                disabled={chapter.status !== "done"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:bg-neutral-700 disabled:text-neutral-500"
                aria-label="Phát chương"
              >
                {chapter.status === "generating" ? <ClipLoader size={14} color="#a3a3a3" /> : <BsPlayFill size={18} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate ${isPlaying ? "text-emerald-400" : "text-white"}`}>{chapter.title}</p>
                <p className="truncate text-xs text-neutral-500">
                  {chapter.char_count.toLocaleString("vi-VN")} chữ
                  {CHAPTER_STATUS[chapter.status] && (
                    <span className={chapter.status === "error" ? "text-red-400" : "text-amber-300"}>
                      {" "}
                      · {CHAPTER_STATUS[chapter.status]}
                      {chapter.error ? `: ${chapter.error}` : ""}
                    </span>
                  )}
                </p>
              </div>
              {chapter.duration && (
                <span className="text-sm tabular-nums text-neutral-400">{formatDuration(chapter.duration)}</span>
              )}
              <button
                onClick={() => showText(chapter)}
                className="text-neutral-400 hover:text-white"
                aria-label="Xem chữ"
                title="Xem chữ"
              >
                <HiDocumentText size={20} />
              </button>
              {chapter.status === "done" && (
                <a
                  href={`/api/chapters/${chapter.id}/audio?download=1`}
                  className="text-neutral-400 hover:text-white"
                  aria-label="Tải mp3"
                  title="Tải mp3"
                >
                  <HiArrowDownTray size={20} />
                </a>
              )}
            </li>
          );
        })}
        {working && (
          <li className="flex items-center gap-x-3 px-3 py-3 text-sm text-neutral-400">
            <ClipLoader size={16} color="#10b981" /> Đang lấy và đọc các chương tiếp theo…
          </li>
        )}
      </ol>

      {reading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setReading(null)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-neutral-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setReading(null)}
              className="absolute right-3 top-3 text-neutral-400 hover:text-white"
              aria-label="Đóng"
            >
              <HiXMark size={24} />
            </button>
            <h2 className="pr-8 text-xl font-semibold text-white">{reading.title}</h2>
            <div className="mt-4 overflow-y-auto whitespace-pre-line leading-relaxed text-neutral-200">
              {reading.text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
