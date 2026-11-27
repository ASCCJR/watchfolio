import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { MemeRecipe } from "@/lib/artwork";

export const personalPosters = sqliteTable("personal_posters", {
  ownerId: text("owner_id").notNull(),
  titleKey: text("title_key").notNull(),
  revision: text("revision").notNull(),
  photo: text("photo").notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.titleKey] })]);

export const personalMemes = sqliteTable("personal_memes", {
  ownerId: text("owner_id").notNull(),
  titleKey: text("title_key").notNull(),
  id: text("id").notNull(),
  revision: text("revision").notNull(),
  recipe: text("recipe", { mode: "json" }).$type<MemeRecipe>().notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.titleKey, table.id] })]);
