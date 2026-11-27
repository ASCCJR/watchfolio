import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reactionEvents = sqliteTable("reaction_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  titleKey: text("title_key").notNull(),
  titleName: text("title_name").notNull(),
  episodeId: integer("episode_id").notNull(),
  field: text("field", { enum: ["rating", "emotion", "character"] }).notNull(),
  value: text("value"),
  label: text("label"),
  reactedOn: text("reacted_on").notNull(),
}, table => [
  index("reaction_events_target").on(table.ownerId, table.titleKey, table.episodeId, table.field, table.id),
  index("reaction_events_date").on(table.ownerId, table.reactedOn),
]);
