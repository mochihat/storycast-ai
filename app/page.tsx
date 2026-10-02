"use client";

import Link from "next/link";
import { HiPlus } from "react-icons/hi2";

import Cover from "@/components/Cover";
import StatusBadge from "@/components/StatusBadge";
import { usePolling } from "@/hooks/usePolling";
import { formatLength } from "@/lib/format";
import type { Story } from "@/types";

export default function Home() {
  const { data: stories, loading } = usePolling<Story[]>("/api/stories", 4000);

  return (
    <div className="bg-neutral-900 md:rounded-lg min-h-full w-full">
      <div className="bg-linear-to-b from-emerald-800 px-6 pt-8 pb-6 md:rounded-t-lg">
        <h1 className="text-white text-3xl font-semibold">Thư viện truyện audio</h1>
        <p className="mt-2 text-neutral-300">
          Dán link truyện chữ, StoryCast sẽ lấy nội dung từng chương và đọc bằng giọng nữ AI.
        </p>
        <Link
          href="/new"
          className="mt-5 inline-flex items-center gap-x-2 rounded-full bg-emerald-500 px-5 py-2.5 font-semibold text-black hover:bg-emerald-400 transition"
        >
          <HiPlus size={20} /> Thêm truyện mới
        </Link>
      </div>

      <div className="px-6 py-6">
        {!loading && stories?.length === 0 && (
          <p className="text-neutral-400">Thư viện đang trống. Bấm “Thêm truyện mới” để bắt đầu.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-4">
          {stories?.map((story) => (
            <Link
              key={story.id}
              href={`/stories/${story.id}`}
              className="group rounded-md bg-neutral-400/5 p-3 hover:bg-neutral-400/10 transition"
            >
              <Cover src={story.cover_url} alt={story.title} className="aspect-[3/4] w-full" />
              <p className="mt-3 line-clamp-2 font-semibold text-white">{story.title}</p>
              {story.author && <p className="truncate text-sm text-neutral-400">{story.author}</p>}
              <p className="mt-1 text-sm text-neutral-400">
                {story.done_count}/{story.chapter_count} chương · {formatLength(story.total_duration)}
              </p>
              <StatusBadge status={story.status} className="mt-2" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
