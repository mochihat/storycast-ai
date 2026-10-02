import { create } from "zustand";

export interface Track {
  chapterId: number;
  storyId: number;
  title: string;
  storyTitle: string;
  cover: string | null;
}

// The playlist is the chapters of one story; the player moves through them in order.
interface PlayerStore {
  tracks: Track[];
  index: number;
  play: (tracks: Track[], index: number) => void;
  setIndex: (index: number) => void;
  reset: () => void;
}

const usePlayer = create<PlayerStore>((set) => ({
  tracks: [],
  index: -1,
  play: (tracks, index) => set({ tracks, index }),
  setIndex: (index) => set({ index }),
  reset: () => set({ tracks: [], index: -1 }),
}));

export default usePlayer;
