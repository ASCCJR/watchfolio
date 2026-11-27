import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Title } from "@/lib/titles";

// Ordered snapshots keep a collection readable if a title leaves the shelf or its source goes offline.
export const personalLists = sqliteTable("personal_lists", {
  ownerId: text("owner_id").notNull(),
  id: text("id").notNull(),
  name: text("name").notNull(),
  titles: text("titles", { mode: "json" }).$type<Title[]>().notNull(),
  revision: integer("revision").notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.id] })]);
