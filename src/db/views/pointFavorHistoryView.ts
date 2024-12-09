import { endorsementsTable, negationsTable, pointsTable } from "@/db/schema";
import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { restakesTable } from "@/db/tables/restakesTable";
import { doubtsTable } from "@/db/tables/doubtsTable";
import { slashingEventsTable } from "@/db/tables/slashingEventsTable";

export type PointFavorHistoryViewEventType = "point_created" | "endorsement_made" | "negation_made" | "negation_endorsed" | "favor_queried" | "restake_made" | "doubt_placed" | "stake_slashed";

export const pointFavorHistoryView = pgView("point_favor_history").as((qb) => {
  const allEvents = qb.$with("all_events").as(
    qb
      .select({
        point_id: sql`${pointsTable.id} as point_id`,
        event_time: sql`${pointsTable.createdAt} as event_time`,
        event_type: sql<PointFavorHistoryViewEventType>`'point_created' as event_type`,
        base_cred: sql`COALESCE((
          SELECT SUM("cred")
          FROM ${endorsementsTable}
          WHERE point_id = ${pointsTable.id}
          AND created_at <= ${pointsTable.createdAt}
        ), 0)`,
        restake_amount: sql`COALESCE((
          SELECT SUM(amount)
          FROM ${restakesTable}
          WHERE point_id = ${pointsTable.id}
          AND status = 'active'
          AND created_at <= ${pointsTable.createdAt}
        ), 0)`,
        doubt_amount: sql`COALESCE((
          SELECT SUM(amount)
          FROM ${doubtsTable}
          WHERE point_id = ${pointsTable.id}
          AND status = 'active'
          AND created_at <= ${pointsTable.createdAt}
        ), 0)`
      })
      .from(pointsTable)
  );

  return qb
    .select({
      pointId: sql`point_id`.as('point_id'),
      eventTime: sql`event_time`.as('event_time'),
      eventType: sql<PointFavorHistoryViewEventType>`event_type`.as('event_type'),
      cred: sql`base_cred + restake_amount - doubt_amount`.as('cred'),
      favor: sql`CAST(
        CASE
          WHEN base_cred + restake_amount - doubt_amount = 0 THEN 0
          WHEN base_cred = 0 THEN 100
          ELSE ROUND(100.0 * (base_cred + restake_amount - doubt_amount) / (base_cred + restake_amount), 2)
        END
      AS NUMERIC)`.as('favor')
    })
    .from(allEvents)
    .orderBy(sql`event_time`, sql`point_id`);
});
