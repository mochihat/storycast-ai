"use client";

import { useState } from "react";
import { HiBookOpen } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

interface CoverProps {
  src: string | null;
  alt: string;
  className?: string;
}

// Story covers come from other sites, so fall back to an icon if they fail to load.
const Cover: React.FC<CoverProps> = ({ src, alt, className }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={twMerge("relative overflow-hidden rounded-md bg-neutral-800 shrink-0", className)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-emerald-700 to-neutral-900">
          <HiBookOpen className="h-1/2 w-1/2 text-white/80" />
        </div>
      )}
    </div>
  );
};

export default Cover;
