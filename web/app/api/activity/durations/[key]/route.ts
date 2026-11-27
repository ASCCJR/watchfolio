import { libraryJson, withLibraryUser } from "@/app/api/library/response";
import { parseTitleKey } from "@/app/api/shelf/input";
import { openShelf } from "@/db/shelf";
import { episodeSnapshot } from "@/lib/catalog";
import { getTitle } from "@/lib/titles";

export function POST(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  return withLibraryUser(async owner => {
    const key = parseTitleKey((await params).key);
    const db = await openShelf(owner);
    const pending = await db.prepare(`SELECT DISTINCT episode_id FROM watch_sessions
      WHERE owner_id = ? AND title_key = ? AND duration_seconds IS NULL`)
      .bind(owner, key).all<{ episode_id: number | null }>();
    if (!pending.results.length) return libraryJson({ updated: 0 });

    const detail = await getTitle(key);
    const ids = new Set(pending.results.map(row => row.episode_id));
    const snapshots = detail.title.kind === "movie"
      ? [{ id: null, seconds: detail.durationSeconds, label: null }]
      : detail.episodes.filter(episode => ids.has(episode.id)).map(episodeSnapshot);
    const known = snapshots.filter(snapshot => snapshot.seconds != null);
    if (!known.length) return libraryJson({ updated: 0 });

    const result = await db.prepare(`UPDATE watch_sessions AS s
      SET duration_seconds = item.value ->> 'seconds', episode_label = coalesce(s.episode_label, item.value ->> 'label')
      FROM json_each(?1) AS item
      WHERE s.owner_id = ?2 AND s.title_key = ?3 AND s.duration_seconds IS NULL
        AND s.episode_id IS (item.value ->> 'id')`)
      .bind(JSON.stringify(known), owner, key).run();
    return libraryJson({ updated: result.meta.changes });
  });
}
