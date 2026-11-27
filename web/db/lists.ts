import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { personalLists } from "./list-schema";
import type { Title } from "@/lib/titles";

const fields = {
  id: personalLists.id, name: personalLists.name, titles: personalLists.titles, revision: personalLists.revision,
};

export async function readLists(ownerId: string) {
  return getDb().select(fields).from(personalLists).where(eq(personalLists.ownerId, ownerId))
    .orderBy(asc(personalLists.name), asc(personalLists.id));
}

function owned(ownerId: string, id: string) {
  return and(eq(personalLists.ownerId, ownerId), eq(personalLists.id, id));
}

export function readList(ownerId: string, id: string) {
  return getDb().select(fields).from(personalLists).where(owned(ownerId, id)).get();
}

export async function createList(ownerId: string, id: string, name: string) {
  await getDb().insert(personalLists).values({ ownerId, id, name, titles: [], revision: 1 }).onConflictDoNothing();
}

export async function updateList(ownerId: string, id: string, revision: number, changes: {name?: string; titles?: Title[]}) {
  const updated = await getDb().update(personalLists).set({ ...changes, revision: revision + 1 })
    .where(and(owned(ownerId, id), eq(personalLists.revision, revision))).returning({ id: personalLists.id });
  return updated.length === 1;
}

export async function deleteList(ownerId: string, id: string, revision: number) {
  const removed = await getDb().delete(personalLists).where(and(owned(ownerId, id), eq(personalLists.revision, revision)))
    .returning({ id: personalLists.id });
  return removed.length === 1;
}
