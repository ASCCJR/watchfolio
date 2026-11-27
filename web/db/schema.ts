import { sql } from "drizzle-orm";
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Show } from "@/lib/catalog";
import type { Title } from "@/lib/titles";
import type { ShelfStatus } from "./shelf-types";
export { personalLists } from "./list-schema";
export { personalMemes, personalPosters } from "./artwork-schema";
export * from "./reaction-schema";

export const shelfImports = sqliteTable("shelf_imports", {
  ownerId: text("owner_id").primaryKey().notNull(),
});

export const shelfEntries = sqliteTable("shelf_entries", {
  ownerId: text("owner_id").notNull(),
  titleKey: text("title_key").notNull(),
  details: text("details", { mode: "json" }).$type<Title>().notNull(),
  status: text("status").$type<ShelfStatus>(),
  addedAt: text("added_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [primaryKey({ columns: [t.ownerId, t.titleKey] })]);

export const watchOperations = sqliteTable("watch_operations", {
  ownerId: text("owner_id").notNull(),
  titleKey: text("title_key").notNull(),
  id: text("id").notNull(),
  payload: text("payload").notNull(),
  nonce: text("nonce").notNull(),
}, (t) => [primaryKey({ columns: [t.ownerId, t.titleKey, t.id] })]);

export const watchSessions = sqliteTable("watch_sessions", {
  ownerId: text("owner_id").notNull(),
  titleKey: text("title_key").notNull(),
  id: text("id").notNull(),
  episodeId: integer("episode_id"),
  episodeLabel: text("episode_label"),
  durationSeconds: integer("duration_seconds"),
  watchedOn: text("watched_on").notNull(),
  operationId: text("operation_id"),
}, (t) => [
  primaryKey({ columns: [t.ownerId, t.titleKey, t.id] }),
  foreignKey({
    columns: [t.ownerId, t.titleKey],
    foreignColumns: [shelfEntries.ownerId, shelfEntries.titleKey],
  }).onDelete("cascade"),
  index("watch_sessions_item").on(t.ownerId, t.titleKey, t.episodeId),
  index("watch_sessions_operation").on(t.ownerId, t.titleKey, t.operationId),
]);

export const libraryShows = sqliteTable("library_tvmaze_shows", {
  ownerId: text("owner_id").notNull(),
  showId: integer("show_id").notNull(),
  details: text("details", { mode: "json" }).$type<Show>().notNull(),
  addedAt: text("added_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerId, table.showId] }),
]);

export const watchedEpisodes = sqliteTable("watched_tvmaze_episodes", {
  ownerId: text("owner_id").notNull(),
  showId: integer("show_id").notNull(),
  episodeId: integer("episode_id").notNull(),
  watchedAt: text("watched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerId, table.showId, table.episodeId] }),
  foreignKey({
    columns: [table.ownerId, table.showId],
    foreignColumns: [libraryShows.ownerId, libraryShows.showId],
  }).onDelete("cascade"),
]);
