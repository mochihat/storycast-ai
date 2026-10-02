"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiHome, HiPlus } from "react-icons/hi2";
import { TbPlaylist } from "react-icons/tb";
import { twMerge } from "tailwind-merge";

import { usePolling } from "@/hooks/usePolling";
import type { Story } from "@/types";

import Cover from "./Cover";

const Sidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { data: stories } = usePolling<Story[]>("/api/stories", 5000);

  const routes = [
    { icon: HiHome, label: "Thư viện", href: "/", active: pathname === "/" },
    { icon: HiPlus, label: "Thêm truyện", href: "/new", active: pathname === "/new" },
  ];

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden md:flex flex-col gap-y-2 bg-black h-full w-[300px] p-2 shrink-0">
        <div className="rounded-lg bg-neutral-900 flex flex-col gap-y-4 px-5 py-4">
          <Link href="/" className="text-xl font-bold text-white">
            Story<span className="text-emerald-500">Cast</span>
          </Link>
          {routes.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={twMerge(
                "flex items-center gap-x-4 text-md font-medium text-neutral-400 hover:text-white transition",
                item.active && "text-white",
              )}
            >
              <item.icon size={24} />
              {item.label}
            </Link>
          ))}
        </div>
        <div className="rounded-lg bg-neutral-900 overflow-y-auto h-full">
          <div className="flex items-center gap-x-2 px-5 pt-4 text-neutral-400">
            <TbPlaylist size={24} />
            <p className="font-medium">Truyện của tôi</p>
          </div>
          <div className="flex flex-col gap-y-1 mt-3 px-3 pb-3">
            {stories?.length === 0 && <p className="px-2 text-sm text-neutral-500">Chưa có truyện nào.</p>}
            {stories?.map((story) => (
              <Link
                key={story.id}
                href={`/stories/${story.id}`}
                className={twMerge(
                  "flex items-center gap-x-3 rounded-md p-2 hover:bg-neutral-800/60 transition",
                  pathname === `/stories/${story.id}` && "bg-neutral-800",
                )}
              >
                <Cover src={story.cover_url} alt={story.title} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="truncate text-white">{story.title}</p>
                  <p className="truncate text-sm text-neutral-400">
                    {story.done_count}/{story.chapter_count} chương có audio
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <main className="h-full flex-1 min-w-0 overflow-y-auto py-2 md:pr-2">
        {/* Phone layout: no sidebar, just a slim top bar */}
        <nav className="md:hidden flex items-center justify-between px-4 pb-2">
          <Link href="/" className="text-lg font-bold text-white">
            Story<span className="text-emerald-500">Cast</span>
          </Link>
          <div className="flex gap-x-2">
            {routes.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full bg-white p-2 text-black"
                aria-label={item.label}
              >
                <item.icon size={18} />
              </Link>
            ))}
          </div>
        </nav>
        {children}
      </main>
    </div>
  );
};

export default Sidebar;
