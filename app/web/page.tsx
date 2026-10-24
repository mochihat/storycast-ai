"use client";

import { use, useState } from "react";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";

export default function WebReader({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const initial = use(searchParams).url ?? "";
  const [url, setUrl] = useState(initial);
  const [src, setSrc] = useState(initial ? `/api/web?url=${encodeURIComponent(initial)}` : "");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSrc(`/api/web?url=${encodeURIComponent(url.trim())}`);
  };

  return (
    <div className="bg-neutral-900 md:rounded-lg h-full w-full flex flex-col">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2 px-4 py-4 md:px-6">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán link bất kỳ trang nào của PO18 hoặc web truyện tiếng Trung"
          className="min-w-0 flex-1 rounded-md bg-neutral-700 px-3 py-2.5 text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="rounded-full bg-emerald-500 px-6 py-2.5 font-semibold text-black hover:bg-emerald-400 transition"
        >
          Dịch trang
        </button>
        {src && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-x-1 px-2 text-sm text-neutral-400 hover:text-white"
          >
            <HiArrowTopRightOnSquare size={16} /> Mở tab mới
          </a>
        )}
      </form>
      {src ? (
        // No allow-scripts: the translated page is plain HTML, and nothing from the site may run here.
        <iframe
          key={src}
          src={src}
          title="Trang đã dịch"
          sandbox="allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
          className="flex-1 w-full bg-white md:rounded-b-lg"
        />
      ) : (
        <p className="px-6 text-neutral-400">
          Dán link trang chủ, trang truyện, bảng xếp hạng hay một chương của PO18. Cả trang sẽ được convert sang tiếng Việt
          (tên đọc Hán Việt), và bấm vào link nào trong trang cũng tiếp tục được dịch.
        </p>
      )}
    </div>
  );
}
