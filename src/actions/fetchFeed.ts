"use server";

import { getUserId } from "@/actions/getUserId";
import { endorsementsTable, pointsWithDetailsView } from "@/db/schema";
import { getColumns } from "@/db/utils/getColumns";
import { db } from "@/services/db";
import { Timestamp } from "@/types/Timestamp";
import { desc, sql } from "drizzle-orm";

export const fetchFeedPage = async (olderThan?: Timestamp) => {
  const viewerId = await getUserId();

  return await db
    .select({
      ...getColumns(pointsWithDetailsView),
      ...(viewerId
        ? {
            viewerCred: sql<number>`
              COALESCE((
                SELECT SUM(${endorsementsTable.cred})
                FROM ${endorsementsTable}
                WHERE ${endorsementsTable.pointId} = ${pointsWithDetailsView.pointId}
                  AND ${endorsementsTable.userId} = ${viewerId}
              ), 0)
            `.mapWith(Number),
          }
        : {}),
    })
    .from(pointsWithDetailsView)
    .orderBy(desc(pointsWithDetailsView.createdAt));
};
