import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { usersTable } from "@/db/tables/usersTable";
import { restakesTable } from "@/db/tables/restakesTable";
import { doubtsTable } from "@/db/tables/doubtsTable";
import { slashingEventsTable } from "@/db/tables/slashingEventsTable";

export const userStakingStatsView = pgView("user_staking_stats_view").as((qb) =>
  qb
    .select({
      userId: usersTable.id,
      totalRestakedAmount: sql`COALESCE(SUM(${restakesTable.amount}), 0)`.mapWith(Number).as("total_restaked_amount"),
      totalDoubtedAmount: sql`COALESCE(SUM(${doubtsTable.amount}), 0)`.mapWith(Number).as("total_doubted_amount"),
      activeRestakesCount: sql`COUNT(CASE WHEN ${restakesTable.status} = 'active' THEN 1 END)`.mapWith(Number).as("active_restakes_count"),
      successfulDoubtsCount: sql`COUNT(CASE WHEN ${doubtsTable.status} = 'resolved' THEN 1 END)`.mapWith(Number).as("successful_doubts_count"),
      totalSlashedAmount: sql`COALESCE(SUM(${slashingEventsTable.amount}), 0)`.mapWith(Number).as("total_slashed_amount"),
      averageStakeDuration: sql`EXTRACT(EPOCH FROM AVG(
        CASE 
          WHEN ${restakesTable.status} = 'active' THEN NOW() - ${restakesTable.createdAt}
          ELSE ${slashingEventsTable.createdAt} - ${restakesTable.createdAt}
        END
      )) / 86400`.mapWith(Number).as("average_stake_duration")
    })
    .from(usersTable)
    .leftJoin(restakesTable, sql`${restakesTable.userId} = ${usersTable.id}`)
    .leftJoin(doubtsTable, sql`${doubtsTable.userId} = ${usersTable.id}`)
    .leftJoin(slashingEventsTable, sql`${slashingEventsTable.userId} = ${usersTable.id}`)
    .groupBy(usersTable.id)
); 