import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { pointsTable } from "@/db/tables/pointsTable";
import { restakesTable } from "@/db/tables/restakesTable";
import { doubtsTable } from "@/db/tables/doubtsTable";
import { slashingEventsTable } from "@/db/tables/slashingEventsTable";

export const restakeDetailsView = pgView("restake_details_view").as((qb) =>
  qb
    .select({
      pointId: pointsTable.id,
      totalRestakedAmount: sql`COALESCE(SUM(${restakesTable.amount}), 0)`.mapWith(Number).as("total_restaked_amount"),
      activeRestakedAmount: sql`COALESCE(SUM(CASE WHEN ${restakesTable.status} = 'active' THEN ${restakesTable.amount} ELSE 0 END), 0)`.mapWith(Number).as("active_restaked_amount"),
      slashedAmount: sql`COALESCE(SUM(${slashingEventsTable.amount}), 0)`.mapWith(Number).as("slashed_amount"),
      uniqueRestakersCount: sql`COUNT(DISTINCT ${restakesTable.userId})`.mapWith(Number).as("unique_restakers_count"),
      totalDoubtAmount: sql`COALESCE(SUM(${doubtsTable.amount}), 0)`.mapWith(Number).as("total_doubt_amount"),
      uniqueDoubtersCount: sql`COUNT(DISTINCT ${doubtsTable.userId})`.mapWith(Number).as("unique_doubters_count"),
      lastActivityTimestamp: sql`GREATEST(MAX(${restakesTable.updatedAt}), MAX(${doubtsTable.createdAt}), MAX(${slashingEventsTable.createdAt}))`.as("last_activity_timestamp")
    })
    .from(pointsTable)
    .leftJoin(restakesTable, sql`${restakesTable.pointId} = ${pointsTable.id}`)
    .leftJoin(doubtsTable, sql`${doubtsTable.pointId} = ${pointsTable.id}`)
    .leftJoin(slashingEventsTable, sql`${slashingEventsTable.restakeId} = ${restakesTable.id}`)
    .groupBy(pointsTable.id)
); 