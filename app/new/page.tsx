"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { BeatLoader } from "react-spinners";

import { formatRate } from "@/lib/format";

export default function NewStory() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [chapters, setChapters] = useState(20);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, chapters, rate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Có lỗi xảy ra");
      toast.success("Đã thêm truyện! Đang tạo audio…");
      router.push(`/stories/${json.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 md:rounded-lg min-h-full w-full">
      <div className="bg-linear-to-b from-emerald-800 px-6 pt-8 pb-6 md:rounded-t-lg">
        <h1 className="text-white text-3xl font-semibold">Thêm truyện mới</h1>
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl px-6 py-6 flex flex-col gap-y-6">
        <label className="flex flex-col gap-y-2">
          <span className="font-medium text-white">Link truyện</span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            placeholder="https://truyenfull.today/ten-truyen/chuong-1/"
            className="rounded-md bg-neutral-700 px-3 py-3 text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-sm text-neutral-400">
            Dán link của <b>chương muốn bắt đầu nghe</b> (ví dụ chương 1), hoặc link trang giới thiệu truyện. Ứng dụng
            sẽ tự đi theo nút “Chương sau” để lấy các chương tiếp theo.
          </span>
        </label>

        <label className="flex flex-col gap-y-2">
          <span className="font-medium text-white">Số chương muốn tạo: {chapters}</span>
          <input
            type="number"
            min={1}
            max={2000}
            value={chapters}
            onChange={(e) => setChapters(Number(e.target.value))}
            disabled={loading}
            className="w-40 rounded-md bg-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-sm text-neutral-400">
            Mỗi chương mất khoảng 30 giây – 2 phút để tạo. Bạn có thể nghe chương 1 ngay khi nó xong và lấy thêm chương
            sau.
          </span>
        </label>

        <label className="flex flex-col gap-y-2">
          <span className="font-medium text-white">Tốc độ giọng đọc: {formatRate(rate)}</span>
          <input
            type="range"
            min={-30}
            max={50}
            step={5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            disabled={loading}
            className="w-full max-w-sm accent-emerald-500"
          />
          <span className="text-sm text-neutral-400">
            Giọng: <b>Hoài My</b> (nữ, tiếng Việt). Bạn vẫn chỉnh được tốc độ nghe trên trình phát.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-full bg-emerald-500 px-8 py-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 transition"
        >
          {loading ? <BeatLoader size={10} color="#000" /> : "Tạo truyện audio"}
        </button>
        {loading && <p className="text-sm text-neutral-400">Đang đọc trang truyện…</p>}
      </form>
    </div>
  );
}
