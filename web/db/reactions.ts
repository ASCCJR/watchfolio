import { getDatabase } from "./index";
import { ShelfError } from "./shelf-types";
import type { Emotion, Reaction } from "@/lib/reaction-types";

export type ReactionChange = { field: "rating" | "emotion" | "character"; value: string | null; label?: string };

export async function readReaction(owner: string, key: string, episode: number) {
  const rows = await getDatabase().prepare(`SELECT id, field, value, label, title_name
    FROM reaction_events WHERE id IN (
      SELECT max(id) FROM reaction_events WHERE owner_id = ? AND title_key = ? AND episode_id = ? GROUP BY field
    ) ORDER BY id DESC`).bind(owner, key, episode)
    .all<{ id: number; field: string; value: string | null; label: string | null; title_name: string }>();
  const reaction: Reaction = { revision: rows.results[0]?.id ?? 0, rating: null, emotion: null, character: null };
  for (const row of rows.results) {
    if (row.value === null) continue;
    if (row.field === "rating") reaction.rating = Number(row.value);
    if (row.field === "emotion") reaction.emotion = row.value as Emotion;
    if (row.field === "character" && row.label) reaction.character = { id: row.value, name: row.label };
  }
  return { reaction, titleName: rows.results[0]?.title_name };
}

export function staleReaction() {
  return new ShelfError(409, "A reação mudou em outra aba. Confira a versão atual antes de salvar.");
}

export async function writeReaction(
  owner: string, key: string, episode: number, name: string, date: string, revision: number, changes: ReactionChange[],
) {
  // Capture the previous revision once, before inserting any of the changed fields.
  const result = await getDatabase().prepare(`WITH previous AS MATERIALIZED (
        SELECT coalesce(max(id), 0) AS revision FROM reaction_events
        WHERE owner_id = ?1 AND title_key = ?2 AND episode_id = ?3
      )
      INSERT INTO reaction_events (owner_id, title_key, episode_id, title_name, reacted_on, field, value, label)
      SELECT ?1, ?2, ?3, ?4, ?5, json_extract(j.value, '$.field'), json_extract(j.value, '$.value'), json_extract(j.value, '$.label')
      FROM previous, json_each(?7) AS j WHERE previous.revision = ?6`)
    .bind(owner, key, episode, name, date, revision, JSON.stringify(changes)).run();
  if (!result.meta.changes) throw staleReaction();
}
