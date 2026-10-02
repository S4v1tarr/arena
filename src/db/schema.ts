import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { GameState } from "@/game/types";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  country: text("country").notNull().default("IR"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  mode: text("mode").notNull(), // 'bot' | 'pvp'
  status: text("status").notNull().default("waiting"), // waiting | active | finished
  difficulty: text("difficulty").notNull().default("normal"),
  p1UserId: integer("p1_user_id").references(() => users.id),
  p2UserId: integer("p2_user_id").references(() => users.id),
  p1Country: text("p1_country").notNull(),
  p2Country: text("p2_country").notNull().default("US"),
  winnerSide: integer("winner_side"),
  state: jsonb("state").$type<GameState>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
