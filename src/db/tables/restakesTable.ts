import { pgTable, serial, integer, timestamp, varchar, pgEnum, unique, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pointsTable } from "./pointsTable";
import { usersTable } from "./usersTable";

export const stakeStatusEnum = pgEnum('stake_status', ['active', 'slashed']);

export const restakesTable = pgTable("restakes", {
  id: serial("id").primaryKey(),
  pointId: integer("point_id")
    .references(() => pointsTable.id, { onDelete: "cascade" })
    .notNull(),
  negationId: integer("negation_id")
    .references(() => pointsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  status: stakeStatusEnum("status").notNull().default('active'),
}, (table) => ({
  uniqueUserStakeConstraint: unique("unique_user_stake").on(
    table.userId, 
    table.pointId, 
    table.negationId
  ),
  pointIdIndex: index("restakes_point_id_idx").on(table.pointId),
  negationIdIndex: index("restakes_negation_id_idx").on(table.negationId),
  userIdIndex: index("restakes_user_id_idx").on(table.userId),
  nonNegativeAmount: check("non_negative_amount", sql`${table.amount} >= 0`)
})); 