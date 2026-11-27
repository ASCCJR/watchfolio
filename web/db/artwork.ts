import { getDatabase } from "./index";
import { ShelfError } from "./shelf-types";
import type { MemeRecipe, SavedMeme } from "@/lib/artwork";

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

function checkVersion(row: { revision: string } | undefined, expected: string | null) {
  if ((row?.revision ?? null) !== expected) throw new ShelfError(409, "A imagem mudou em outro aparelho. Reabra o editor para ver a versão atual.");
}

export async function listPosters(owner: string) {
  const { results } = await getDatabase().prepare("SELECT title_key, revision FROM personal_posters WHERE owner_id = ?")
    .bind(owner).all<{ title_key: string; revision: string }>();
  return Object.fromEntries(results.map(row => [row.title_key, row.revision]));
}

export async function readPoster(owner: string, key: string) {
  const row = await getDatabase().prepare("SELECT photo FROM personal_posters WHERE owner_id = ? AND title_key = ?").bind(owner, key).first<{ photo: string }>();
  if (!row) throw new ShelfError(404, "Pôster não encontrado.");
  const binary = atob(row.photo.slice(row.photo.indexOf(",") + 1));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function savePoster(owner: string, key: string, expected: string | null, photo: string) {
  const db = getDatabase(), next = await digest(photo);
  const write = expected === null
    ? db.prepare("INSERT OR IGNORE INTO personal_posters (owner_id,title_key,revision,photo) VALUES (?,?,?,?)").bind(owner, key, next, photo)
    : db.prepare("UPDATE personal_posters SET revision=?, photo=? WHERE owner_id=? AND title_key=? AND revision=?").bind(next, photo, owner, key, expected);
  const [, read] = await db.batch<{ revision: string }>([write, db.prepare("SELECT revision FROM personal_posters WHERE owner_id=? AND title_key=?").bind(owner, key)]);
  checkVersion(read.results[0], next);
  return next;
}

export async function removePoster(owner: string, key: string, expected: string) {
  const db = getDatabase();
  const [, read] = await db.batch<{ revision: string }>([
    db.prepare("DELETE FROM personal_posters WHERE owner_id=? AND title_key=? AND revision=?").bind(owner, key, expected),
    db.prepare("SELECT revision FROM personal_posters WHERE owner_id=? AND title_key=?").bind(owner, key),
  ]);
  checkVersion(read.results[0], null);
}

export async function listMemes(owner: string, key: string) {
  const { results } = await getDatabase().prepare(`SELECT id, revision, updated_at AS updatedAt, json_extract(recipe, '$.caption') AS caption
    FROM personal_memes WHERE owner_id=? AND title_key=? ORDER BY updated_at DESC, id`).bind(owner, key).all<SavedMeme>();
  return results;
}

export async function readMeme(owner: string, key: string, id: string) {
  const row = await getDatabase().prepare("SELECT recipe, revision FROM personal_memes WHERE owner_id=? AND title_key=? AND id=?")
    .bind(owner, key, id).first<{ recipe: string; revision: string }>();
  if (!row) throw new ShelfError(404, "Meme não encontrado.");
  return { id, revision: row.revision, recipe: JSON.parse(row.recipe) as MemeRecipe };
}

export async function saveMeme(owner: string, key: string, id: string, expected: string | null, recipe: MemeRecipe) {
  const db = getDatabase(), json = JSON.stringify(recipe), next = await digest(json), now = new Date().toISOString();
  const write = expected === null
    ? db.prepare("INSERT OR IGNORE INTO personal_memes (owner_id,title_key,id,revision,recipe,updated_at) VALUES (?,?,?,?,?,?)").bind(owner, key, id, next, json, now)
    : db.prepare("UPDATE personal_memes SET revision=?, recipe=?, updated_at=? WHERE owner_id=? AND title_key=? AND id=? AND revision=?")
      .bind(next, json, now, owner, key, id, expected);
  const [, read] = await db.batch<{ revision: string }>([write, db.prepare("SELECT revision FROM personal_memes WHERE owner_id=? AND title_key=? AND id=?").bind(owner, key, id)]);
  checkVersion(read.results[0], next);
  return next;
}

export async function removeMeme(owner: string, key: string, id: string, expected: string) {
  const db = getDatabase();
  const [, read] = await db.batch<{ revision: string }>([
    db.prepare("DELETE FROM personal_memes WHERE owner_id=? AND title_key=? AND id=? AND revision=?").bind(owner, key, id, expected),
    db.prepare("SELECT revision FROM personal_memes WHERE owner_id=? AND title_key=? AND id=?").bind(owner, key, id),
  ]);
  checkVersion(read.results[0], null);
}
