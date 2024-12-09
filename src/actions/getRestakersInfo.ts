'use server'

import { db } from "@/services/db";
import { restakesTable, slashingEventsTable } from "@/db/schema";
import {  sql } from "drizzle-orm";

type QueryResult = {
  restakers: Array<{userId: string, amount: number, reputation: number}>;
  aggregate_reputation: number;
}

export async function getRestakersInfo(pointId: number) {
  const [result] = await db.execute<QueryResult>(sql`
    WITH restaker_stats AS (
      SELECT 
        r.user_id,
        r.amount,
        ROUND(
          COALESCE(
            (
              SELECT COUNT(*) 
              FROM ${slashingEventsTable} se
              JOIN ${restakesTable} r2 ON r2.id = se.restake_id
              WHERE r2.user_id = r.user_id 
              AND r2.status = 'slashed'
            )::float / 
            NULLIF((
              SELECT COUNT(*) 
              FROM ${restakesTable} r3
              WHERE r3.user_id = r.user_id
            ), 0) * 100,
            0
          )
        ) as reputation
      FROM ${restakesTable} r
      WHERE r.point_id = ${pointId}
      AND r.status = 'active'
    )
    SELECT 
      json_agg(restaker_stats.*) as restakers,
      ROUND(
        COALESCE(
          SUM(amount * reputation) / NULLIF(SUM(amount), 0),
          0
        )
      ) as aggregate_reputation
    FROM restaker_stats
  `);

  return {
    restakers: result?.restakers ?? [],
    aggregateReputation: result?.aggregate_reputation ?? 0
  };
} 