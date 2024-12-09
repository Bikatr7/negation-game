import { pgTable, serial, integer, timestamp, varchar, pgEnum, unique, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pointsTable } from "./pointsTable";
import { usersTable } from "./usersTable";

export const doubtStatusEnum = pgEnum('doubt_status', ['active', 'resolved']);

export const doubtsTable = pgTable("doubts", {
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
  status: doubtStatusEnum("status").notNull().default('active'),
}, (table) => ({
  uniqueUserDoubtConstraint: unique("unique_user_doubt").on(
    table.userId, 
    table.pointId, 
    table.negationId
  ),
  pointIdIndex: index("doubts_point_id_idx").on(table.pointId),
  negationIdIndex: index("doubts_negation_id_idx").on(table.negationId),
  userIdIndex: index("doubts_user_id_idx").on(table.userId),
  nonNegativeAmount: check("non_negative_amount", sql`${table.amount} >= 0`)
})); 