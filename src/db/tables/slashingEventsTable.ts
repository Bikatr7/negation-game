import { pgTable, serial, integer, timestamp, varchar, text, index,check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { restakesTable } from "./restakesTable";
import { usersTable } from "./usersTable";

export const slashingEventsTable = pgTable("slashing_events", {
  id: serial("id").primaryKey(),
  restakeId: integer("restake_id")
    .references(() => restakesTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reason: text("reason"),
}, (table) => ({
  restakeIdIndex: index("slashing_restake_id_idx").on(table.restakeId),
  userIdIndex: index("slashing_user_id_idx").on(table.userId),
  nonNegativeAmount: check("non_negative_amount", sql`${table.amount} >= 0`)
})); 