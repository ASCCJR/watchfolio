import { and, asc, desc, eq } from "drizzle-orm";
import type { Show } from "@/lib/catalog";
import { getDb } from "./index";
import { libraryShows, watchedEpisodes } from "./schema";

export async function readLibrary(ownerId: string) {
  const db = getDb();
  const [entries, episodes] = await db.batch([
    db.select({ show: libraryShows.details })
      .from(libraryShows)
      .where(eq(libraryShows.ownerId, ownerId))
      .orderBy(desc(libraryShows.addedAt), asc(libraryShows.showId)),
    db.select({ showId: watchedEpisodes.showId, episodeId: watchedEpisodes.episodeId })
      .from(watchedEpisodes)
      .where(eq(watchedEpisodes.ownerId, ownerId))
      .orderBy(asc(watchedEpisodes.showId), asc(watchedEpisodes.episodeId)),
  ]);

  const shows = entries.map((entry) => entry.show);
  const watched: Record<string, number[]> = {};
  for (const show of shows) watched[show.id] = [];
  for (const episode of episodes) watched[episode.showId].push(episode.episodeId);
  return { shows, watched };
}

export async function saveShow(ownerId: string, show: Show, episodeId?: number) {
  const db = getDb();
  const saveEntry = db.insert(libraryShows)
    .values({ ownerId, showId: show.id, details: show })
    .onConflictDoUpdate({
      target: [libraryShows.ownerId, libraryShows.showId],
      set: { details: show },
    });

  if (episodeId === undefined) {
    await saveEntry;
    return;
  }

  await db.batch([
    saveEntry,
    db.insert(watchedEpisodes)
      .values({ ownerId, showId: show.id, episodeId })
      .onConflictDoNothing(),
  ]);
}

export async function unwatchEpisode(ownerId: string, showId: number, episodeId: number) {
  await getDb().delete(watchedEpisodes).where(and(
    eq(watchedEpisodes.ownerId, ownerId),
    eq(watchedEpisodes.showId, showId),
    eq(watchedEpisodes.episodeId, episodeId),
  ));
}
