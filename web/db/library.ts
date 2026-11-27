import type { Show } from "@/lib/catalog";
import type { Title } from "@/lib/titles";
import { openShelf, readShelf } from "./shelf";
import { ShelfError } from "./shelf-types";

// Compatibility for devices still running the first version of the interface.
export async function readLibrary(owner: string) {
  const { entries } = await readShelf(owner);
  const shows: Show[] = [];
  const watched: Record<string, number[]> = {};
  for (const { title, status, sessions } of entries) {
    if (!title.key.startsWith("tvmaze-") || status === null) continue;
    const id = Number(title.key.slice("tvmaze-".length));
    const { name, image, year, genres, sourceUrl } = title;
    shows.push({ id, name, image, year, genres, sourceUrl });
    watched[id] = [...new Set(sessions.flatMap(s => s.episodeId === null ? [] : [s.episodeId]))]
      .sort((first, second) => first - second);
  }
  return { shows, watched };
}

export async function saveShow(owner: string, show: Show, episodeId?: number) {
  const db = await openShelf(owner);
  const { id, ...metadata } = show;
  const key = `tvmaze-${id}`;
  const title: Title = {
    ...metadata, key, kind: show.genres.some(genre => genre.toLowerCase() === "anime") ? "anime" : "series",
    productionStatus: null,
  };
  const addShow = db.prepare(`INSERT INTO shelf_entries (owner_id, title_key, details, status) VALUES (?, ?, ?, ?)
    ON CONFLICT(owner_id, title_key) DO UPDATE SET status = coalesce(shelf_entries.status, excluded.status)`)
    .bind(owner, key, JSON.stringify(title), episodeId === undefined ? "planned" : "watching");
  if (episodeId === undefined) {
    await addShow.run();
    return;
  }
  await db.batch([
    addShow,
    db.prepare(`INSERT INTO watch_sessions (owner_id, title_key, id, episode_id, watched_on)
      SELECT ?1, ?2, 'legacy-' || ?3, ?3, date('now') WHERE NOT EXISTS (
        SELECT 1 FROM watch_sessions WHERE owner_id = ?1 AND title_key = ?2 AND episode_id = ?3)`)
      .bind(owner, key, episodeId),
  ]);
}

export async function unwatchEpisode(owner: string, showId: number, episodeId: number) {
  const db = await openShelf(owner);
  const key = `tvmaze-${showId}`;
  // The old UI cannot choose which rewatch to remove. Preserve the history.
  const count = "SELECT count(*) FROM watch_sessions WHERE owner_id = ?1 AND title_key = ?2 AND episode_id = ?3";
  const [prior] = await db.batch<{ total: number }>([
    db.prepare(`SELECT (${count}) AS total`).bind(owner, key, episodeId),
    db.prepare(`DELETE FROM watch_sessions WHERE owner_id = ?1 AND title_key = ?2 AND episode_id = ?3
      AND (${count}) = 1`).bind(owner, key, episodeId),
  ]);
  if (Number(prior.results[0].total) > 1) {
    throw new ShelfError(409, "Há mais de uma sessão para este episódio. Escolha a sessão no histórico.");
  }
}
