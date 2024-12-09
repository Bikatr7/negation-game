import { endorsementsTable, negationsTable, pointsTable } from "@/db/schema";
import { InferSelectViewModel } from "../utils/InferSelectViewModel";
import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { restakesTable } from "@/db/tables/restakesTable";
import { doubtsTable } from "@/db/tables/doubtsTable";
import { slashingEventsTable } from "@/db/tables/slashingEventsTable";

export const pointsWithDetailsView = pgView("point_with_details_view").as(
  (qb) =>
    qb
      .select({
        pointId: pointsTable.id,
        content: pointsTable.content,
        createdAt: pointsTable.createdAt,
        createdBy: pointsTable.createdBy,
        amountNegations: sql<number>`
        COALESCE((
          SELECT COUNT(*)
          FROM (
            SELECT older_point_id AS point_id FROM ${negationsTable}
            UNION ALL
            SELECT newer_point_id AS point_id FROM ${negationsTable}
          ) sub
          WHERE point_id = ${pointsTable.id}
        ), 0)
      `.mapWith(Number).as("amount_negations"),
        amountSupporters: sql<number>`
        COALESCE((
          SELECT COUNT(DISTINCT ${endorsementsTable.userId})
          FROM ${endorsementsTable}
          WHERE ${endorsementsTable.pointId} = ${pointsTable.id}
        ), 0)
      `.mapWith(Number).as("amount_supporters"),
        cred: sql<number>`
        COALESCE((
          SELECT SUM(${endorsementsTable.cred})
          FROM ${endorsementsTable}
          WHERE ${endorsementsTable.pointId} = ${pointsTable.id}
        ), 0)
      `.mapWith(Number).as("cred"),
        negationsCred: sql<number>`
        COALESCE((
          SELECT SUM(${endorsementsTable.cred})
          FROM ${endorsementsTable}
          WHERE ${endorsementsTable.pointId} IN (
            SELECT ${negationsTable.newerPointId}
            FROM ${negationsTable}
            WHERE ${negationsTable.olderPointId} = ${pointsTable.id}
            UNION
            SELECT ${negationsTable.olderPointId}
            FROM ${negationsTable}
            WHERE ${negationsTable.newerPointId} = ${pointsTable.id}
          )
        ), 0)
      `.mapWith(Number).as("negations_cred"),
        negationIds: sql<number[]>`
          ARRAY(
            SELECT ${negationsTable.olderPointId}
            FROM ${negationsTable}
            WHERE ${negationsTable.newerPointId} = ${pointsTable.id}
            UNION
            SELECT ${negationsTable.newerPointId}
            FROM ${negationsTable}
            WHERE ${negationsTable.olderPointId} = ${pointsTable.id}
          )
        `.as("negation_ids"),
        totalRestakedAmount: sql<number>`
          COALESCE((
            SELECT SUM(${restakesTable.amount})
            FROM ${restakesTable}
            WHERE ${restakesTable.pointId} = ${pointsTable.id}
            AND ${restakesTable.status} = 'active'
          ), 0)
        `.mapWith(Number).as("total_restaked_amount"),
        activeRestakedAmount: sql<number>`
          COALESCE((
            SELECT SUM(${restakesTable.amount})
            FROM ${restakesTable}
            WHERE ${restakesTable.pointId} = ${pointsTable.id}
            AND ${restakesTable.status} = 'active'
          ), 0)
        `.mapWith(Number).as("active_restaked_amount"),
        totalDoubtAmount: sql<number>`
          COALESCE((
            SELECT SUM(${doubtsTable.amount})
            FROM ${doubtsTable}
            WHERE ${doubtsTable.pointId} = ${pointsTable.id}
            AND ${doubtsTable.status} = 'active'
          ), 0)
        `.mapWith(Number).as("total_doubt_amount"),
        slashingEventsCount: sql<number>`
          COALESCE((
            SELECT COUNT(*)
            FROM ${slashingEventsTable}
            JOIN ${restakesTable} ON ${restakesTable.id} = ${slashingEventsTable.restakeId}
            WHERE ${restakesTable.pointId} = ${pointsTable.id}
          ), 0)
        `.mapWith(Number).as("slashing_events_count")
      })
      .from(pointsTable)
      .$dynamic()
);

export type PointWithDetails = InferSelectViewModel<
  typeof pointsWithDetailsView
>;
