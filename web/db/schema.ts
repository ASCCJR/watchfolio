import { sql } from "drizzle-orm";
import { foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Show } from "@/lib/catalog";

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
