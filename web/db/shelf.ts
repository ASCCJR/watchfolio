import type { Title, TitleDetail } from "@/lib/titles";
import { episodeSnapshot } from "@/lib/catalog";
import { getDatabase } from "./index";
import { ShelfError, type ShelfEntry, type ShelfStatus, type WatchInput, type WatchSession } from "./shelf-types";

// Both generations of routes use these tables after the owner's first access.
// Rechecking the marker inside the batch also handles simultaneous first requests.
export async function openShelf(owner: string) {
  const db = getDatabase();
  const imported = await db.prepare("SELECT 1 FROM shelf_imports WHERE owner_id = ?").bind(owner).first();
  if (imported) return db;

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO shelf_entries (owner_id, title_key, details, status, added_at)
      SELECT s.owner_id, 'tvmaze-' || s.show_id,
        json_remove(json_set(s.details, '$.key', 'tvmaze-' || s.show_id,
          '$.kind', CASE WHEN EXISTS (SELECT 1 FROM json_each(s.details, '$.genres')
              WHERE lower(value) = 'anime') THEN 'anime' ELSE 'series' END,
          '$.productionStatus', NULL), '$.id'),
        CASE WHEN EXISTS (SELECT 1 FROM watched_tvmaze_episodes e
          WHERE e.owner_id = s.owner_id AND e.show_id = s.show_id) THEN 'watching' ELSE 'planned' END,
        s.added_at
      FROM library_tvmaze_shows s WHERE s.owner_id = ?1
        AND NOT EXISTS (SELECT 1 FROM shelf_imports WHERE owner_id = ?1)`).bind(owner),
    db.prepare(`INSERT OR IGNORE INTO watch_sessions (owner_id, title_key, id, episode_id, watched_on)
      SELECT owner_id, 'tvmaze-' || show_id, 'legacy-' || episode_id, episode_id, substr(watched_at, 1, 10)
      FROM watched_tvmaze_episodes WHERE owner_id = ?1
        AND NOT EXISTS (SELECT 1 FROM shelf_imports WHERE owner_id = ?1)`).bind(owner),
    db.prepare("INSERT OR IGNORE INTO shelf_imports (owner_id) VALUES (?)").bind(owner),
  ]);
  return db;
}

export async function readShelf(owner: string): Promise<{ entries: ShelfEntry[] }> {
  const db = await openShelf(owner);
  const [titles, watches] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT title_key, details, status FROM shelf_entries WHERE owner_id = ? ORDER BY added_at DESC, title_key").bind(owner),
    db.prepare(`SELECT title_key, id, episode_id, watched_on, operation_id FROM watch_sessions
      WHERE owner_id = ? ORDER BY watched_on DESC, id`).bind(owner),
  ]);
  const byKey = new Map<string, ShelfEntry>();
  for (const row of titles.results) {
    byKey.set(String(row.title_key), {
      title: JSON.parse(String(row.details)),
      status: row.status as ShelfStatus | null,
      sessions: [],
    });
  }
  for (const row of watches.results) {
    const session: WatchSession = {
      id: String(row.id),
      episodeId: row.episode_id as number | null,
      watchedOn: String(row.watched_on),
      operationId: row.operation_id as string | null,
    };
    byKey.get(String(row.title_key))!.sessions.push(session);
  }
  return { entries: [...byKey.values()].filter(entry => entry.status !== null || entry.sessions.length > 0) };
}

export async function setStatus(owner: string, title: Title, status: ShelfStatus) {
  const db = await openShelf(owner);
  await db.prepare(`INSERT INTO shelf_entries (owner_id, title_key, details, status)
    VALUES (?, ?, ?, ?) ON CONFLICT(owner_id, title_key)
    DO UPDATE SET status = excluded.status, details = excluded.details`)
    .bind(owner, title.key, JSON.stringify(title), status).run();
}

export async function removeFromShelf(owner: string, key: string) {
  const db = await openShelf(owner);
  await db.prepare("UPDATE shelf_entries SET status = NULL WHERE owner_id = ? AND title_key = ?").bind(owner, key).run();
}

function checkOperation(payload: string, input: WatchInput) {
  if (payload !== JSON.stringify(input)) {
    throw new ShelfError(409, "Esta ação já foi usada para uma marcação diferente.");
  }
}

export async function isRecorded(owner: string, key: string, operation: string, input: WatchInput) {
  const db = await openShelf(owner);
  const row = await db.prepare("SELECT payload FROM watch_operations WHERE owner_id = ? AND title_key = ? AND id = ?")
    .bind(owner, key, operation).first<{ payload: string }>();
  if (row) checkOperation(row.payload, input);
  return Boolean(row);
}

export async function recordWatches(owner: string, detail: TitleDetail, operation: string, input: WatchInput) {
  const db = await openShelf(owner);
  const { title } = detail;
  const episodes = new Map(detail.episodes.map(episode => [episode.id, episode]));
  const items = input.episodeIds.map(id => {
    if (id === null) return { id, seconds: detail.durationSeconds ?? null, label: null };
    return episodeSnapshot(episodes.get(id)!);
  });
  const nonce = crypto.randomUUID();
  // Only the request that first claims this operation may create sessions.
  // Keep the operation after undo so a delayed retry cannot recreate them.
  const claim = "SELECT 1 FROM watch_operations WHERE owner_id = ?1 AND title_key = ?2 AND id = ?3 AND nonce = ?4";
  const results = await db.batch<{ payload: string }>([
    db.prepare(`INSERT OR IGNORE INTO watch_operations (owner_id, title_key, id, nonce, payload)
      VALUES (?, ?, ?, ?, ?)`).bind(owner, title.key, operation, nonce, JSON.stringify(input)),
    db.prepare(`INSERT INTO shelf_entries (owner_id, title_key, details, status)
      SELECT ?1, ?2, ?5, ?6 WHERE EXISTS (${claim})
      ON CONFLICT(owner_id, title_key) DO UPDATE SET details = excluded.details`)
      .bind(owner, title.key, operation, nonce, JSON.stringify(title), title.kind === "movie" ? "completed" : "watching"),
    db.prepare(`INSERT INTO watch_sessions (owner_id, title_key, id, episode_id, watched_on, operation_id, duration_seconds, episode_label)
      SELECT ?1, ?2, ?3 || ':' || coalesce(e.value ->> 'id', 'movie'), e.value ->> 'id', ?5, ?3,
        e.value ->> 'seconds', e.value ->> 'label'
      FROM json_each(?6) e WHERE EXISTS (${claim}) AND (?7 = 1 OR NOT EXISTS (
        SELECT 1 FROM watch_sessions s WHERE s.owner_id = ?1 AND s.title_key = ?2 AND s.episode_id IS (e.value ->> 'id')
      ))`).bind(owner, title.key, operation, nonce, input.watchedOn, JSON.stringify(items), Number(input.rewatch)),
    db.prepare("SELECT payload FROM watch_operations WHERE owner_id = ? AND title_key = ? AND id = ?")
      .bind(owner, title.key, operation),
  ]);
  checkOperation(String(results[3].results[0].payload), input);
}

export async function undoWatches(owner: string, key: string, operation: string) {
  const db = await openShelf(owner);
  await db.prepare("DELETE FROM watch_sessions WHERE owner_id = ? AND title_key = ? AND operation_id = ?")
    .bind(owner, key, operation).run();
}

export async function changeSessionDate(owner: string, key: string, session: string, watchedOn: string) {
  const db = await openShelf(owner);
  const result = await db.prepare("UPDATE watch_sessions SET watched_on = ? WHERE owner_id = ? AND title_key = ? AND id = ?")
    .bind(watchedOn, owner, key, session).run();
  if (!result.meta.changes) throw new ShelfError(404, "Sessão não encontrada.");
}

export async function deleteSession(owner: string, key: string, session: string) {
  const db = await openShelf(owner);
  await db.prepare("DELETE FROM watch_sessions WHERE owner_id = ? AND title_key = ? AND id = ?")
    .bind(owner, key, session).run();
}
