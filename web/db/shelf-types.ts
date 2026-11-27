import type { Title } from "@/lib/titles";

export const shelfStatuses = ["planned", "watching", "paused", "completed", "dropped"] as const;
export type ShelfStatus = typeof shelfStatuses[number];

export type WatchSession = {
  id: string;
  episodeId: number | null;
  watchedOn: string;
  operationId: string | null;
};

export type ShelfEntry = {
  title: Title;
  status: ShelfStatus | null;
  sessions: WatchSession[];
};

export type WatchInput = {
  episodeIds: (number | null)[];
  watchedOn: string;
  rewatch: boolean;
};

export class ShelfError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
