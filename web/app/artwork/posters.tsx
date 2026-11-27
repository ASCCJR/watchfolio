"use client";

import { createContext, useContext, type ReactNode } from "react";
import { artworkPath } from "@/lib/artwork";
import { useResource } from "../use-resource";

type PosterIndex = { posters: Record<string, string> };
const PosterContext = createContext<{ index: PosterIndex | null; refresh: () => Promise<void> }>({ index: null, refresh: async () => {} });

export function ArtworkProvider({ children }: { children: ReactNode }) {
  const { data, refresh } = useResource<PosterIndex>("/api/artwork", true);
  return <PosterContext.Provider value={{ index: data, refresh }}>{children}</PosterContext.Provider>;
}

export function usePosterIndex() { return useContext(PosterContext); }

export function usePersonalPoster(key: string) {
  const { index } = usePosterIndex();
  const revision = index?.posters[key];
  return revision ? artworkPath(key) + "/poster?v=" + revision : null;
}
