"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import { MdForward10, MdReplay10 } from "react-icons/md";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";

import usePlayer, { type Track } from "@/hooks/usePlayer";
import { formatDuration } from "@/lib/format";
import { savePosition, loadPosition, saveLastChapter, readSetting, writeSetting } from "@/lib/progress";
import type { StoryWithChapters } from "@/types";

import Cover from "./Cover";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

const Player = () => {
  const { tracks, index, play, setIndex } = usePlayer();
  const track: Track | undefined = tracks[index];
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Settings come from localStorage; the bar is only drawn once a chapter plays, so SSR never shows them.
  const [speed, setSpeed] = useState(() => Number(readSetting("speed")) || 1);
  const [volume, setVolume] = useState(() => {
    const saved = readSetting("volume");
    return saved === null ? 1 : Number(saved);
  });

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, track]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Load a new chapter and continue where we left off in it.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    audio.src = `/api/chapters/${track.chapterId}/audio`;
    const resumeAt = loadPosition(track.chapterId);
    const onLoaded = () => {
      if (resumeAt > 0 && resumeAt < audio.duration - 3) audio.currentTime = resumeAt;
      audio.playbackRate = speed;
      void audio.play().catch(() => setPlaying(false));
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    saveLastChapter(track.storyId, track.chapterId);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        album: track.storyTitle,
        artist: "StoryCast",
        artwork: track.cover ? [{ src: track.cover }] : [],
      });
    }
    const chapterId = track.chapterId;
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      // Leaving this chapter mid-way (next/previous/another story): remember where we were.
      if (audio.currentTime > 0) savePosition(chapterId, audio.currentTime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.chapterId]);

  const goTo = useCallback(
    async (direction: 1 | -1) => {
      const next = index + direction;
      if (next >= 0 && next < tracks.length) return setIndex(next);
      if (direction === -1 || !track) return;
      // Reached the end of the list: chapters may have finished generating since playback started.
      try {
        const res = await fetch(`/api/stories/${track.storyId}`, { cache: "no-store" });
        const story = (await res.json()) as StoryWithChapters;
        const fresh: Track[] = story.chapters
          .filter((c) => c.status === "done")
          .map((c) => ({
            chapterId: c.id,
            storyId: story.id,
            title: c.title,
            storyTitle: story.title,
            cover: story.cover_url,
          }));
        const at = fresh.findIndex((t) => t.chapterId === track.chapterId);
        if (at >= 0 && at + 1 < fresh.length) play(fresh, at + 1);
      } catch {
        // Stay on the last chapter.
      }
    },
    [index, tracks.length, track, setIndex, play],
  );

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("previoustrack", () => void goTo(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => void goTo(1));
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(10));
  }, [goTo]);

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration || 0);
  }

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    writeSetting("speed", String(next));
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    writeSetting("volume", String(value));
  };

  const PlayIcon = playing ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  // The <audio> element stays mounted for the whole session; only the bar around it appears once something plays.
  const audioElement = (
    <audio
      ref={audioRef}
      preload="auto"
      onPlay={() => setPlaying(true)}
      onPause={() => {
        setPlaying(false);
        if (track && audioRef.current) savePosition(track.chapterId, audioRef.current.currentTime);
      }}
      onTimeUpdate={(e) => {
        const t = e.currentTarget.currentTime;
        setTime(t);
        if (track && Math.floor(t) % 5 === 0) savePosition(track.chapterId, t);
      }}
      onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
      onEnded={() => {
        if (track) savePosition(track.chapterId, 0);
        void goTo(1);
      }}
    />
  );

  return (
    <>
      {audioElement}
      {track && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-black border-t border-neutral-800 px-3 py-2 md:px-4">
          <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_2fr_1fr] items-center gap-x-4">
            <Link href={`/stories/${track.storyId}`} className="flex items-center gap-x-3 min-w-0">
              <Cover src={track.cover} alt={track.storyTitle} className="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate text-white text-sm font-medium">{track.title}</p>
                <p className="truncate text-neutral-400 text-xs">{track.storyTitle}</p>
              </div>
            </Link>

            <div className="flex flex-col items-center gap-y-1 min-w-0">
              <div className="flex items-center gap-x-3 md:gap-x-5">
                <button
                  onClick={() => void goTo(-1)}
                  className="hidden sm:block text-neutral-400 hover:text-white"
                  aria-label="Chương trước"
                >
                  <AiFillStepBackward size={24} />
                </button>
                <button
                  onClick={() => skip(-10)}
                  className="hidden sm:block text-neutral-400 hover:text-white"
                  aria-label="Lùi 10 giây"
                >
                  <MdReplay10 size={26} />
                </button>
                <button
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white hover:scale-105 transition"
                  aria-label={playing ? "Tạm dừng" : "Phát"}
                >
                  <PlayIcon size={26} className="text-black" />
                </button>
                <button
                  onClick={() => skip(10)}
                  className="hidden sm:block text-neutral-400 hover:text-white"
                  aria-label="Tới 10 giây"
                >
                  <MdForward10 size={26} />
                </button>
                <button
                  onClick={() => void goTo(1)}
                  className="text-neutral-400 hover:text-white"
                  aria-label="Chương sau"
                >
                  <AiFillStepForward size={24} />
                </button>
                <button
                  onClick={cycleSpeed}
                  className="ml-1 rounded-md border border-neutral-600 px-2 py-0.5 text-xs text-neutral-200 hover:border-white"
                  aria-label="Tốc độ phát"
                >
                  {speed}x
                </button>
              </div>
              <div className="hidden md:flex w-full items-center gap-x-2 text-xs text-neutral-400">
                <span className="w-14 text-right tabular-nums">{formatDuration(time)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={1}
                  value={Math.min(time, duration || 0)}
                  onChange={(e) => {
                    if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
                  }}
                  className="flex-1 accent-emerald-500"
                  aria-label="Vị trí"
                />
                <span className="w-14 tabular-nums">{formatDuration(duration)}</span>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-end gap-x-2">
              <button onClick={() => changeVolume(volume === 0 ? 1 : 0)} aria-label="Tắt tiếng">
                <VolumeIcon size={24} className="text-neutral-300" />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="w-28 accent-emerald-500"
                aria-label="Âm lượng"
              />
            </div>
          </div>

          {/* Phone: thin progress bar under the controls */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
            }}
            className="md:hidden mt-2 w-full accent-emerald-500"
            aria-label="Vị trí"
          />
        </div>
      )}
    </>
  );
};

export default Player;
