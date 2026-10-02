import { twMerge } from "tailwind-merge";

import type { StoryStatus } from "@/types";

const LABELS: Record<StoryStatus, { text: string; className: string }> = {
  queued: { text: "Đang chờ", className: "bg-neutral-700 text-neutral-200" },
  running: { text: "Đang tạo audio", className: "bg-emerald-600 text-white animate-pulse" },
  done: { text: "Hoàn tất", className: "bg-emerald-900 text-emerald-200" },
  paused: { text: "Đã dừng", className: "bg-amber-900 text-amber-200" },
  error: { text: "Lỗi", className: "bg-red-900 text-red-200" },
};

const StatusBadge: React.FC<{ status: StoryStatus; className?: string }> = ({ status, className }) => {
  const label = LABELS[status] ?? LABELS.queued;
  return (
    <span
      className={twMerge("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", label.className, className)}
    >
      {label.text}
    </span>
  );
};

export default StatusBadge;
