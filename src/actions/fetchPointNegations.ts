"use server";

import { getUserId } from "@/actions/getUserId";
import { endorsementsTable, pointsTable } from "@/db/schema";
import { pointCounterpointsJoinView } from "@/db/views/pointCounterpointsJoinView";
import { db } from "@/services/db";
import { eq, sql } from "drizzle-orm";

export const fetchPointNegations = async (id: number) => {
  const viewerId = await getUserId();

  const query = sql`
  SELECT *
  FROM ${pointCounterpointsJoinView}
  LEFT JOIN ${pointsTable} ON ${pointsTable.id} = ${pointCounterpointsJoinView.counterpointId}
  LEFT JOIN (
      SELECT 
          point_id,
          COUNT(*) AS negation_count
      FROM (
          SELECT older_point_id AS point_id FROM negations
          UNION ALL
          SELECT newer_point_id AS point_id FROM negations
      ) sub
      GROUP BY 
          point_id
  ) n ON points.id = n.point_id
  LEFT JOIN (
      SELECT 
          ${endorsementsTable.pointId},
          COUNT(DISTINCT ${endorsementsTable.userId}) AS amount_suporters,
          COALESCE(SUM(${endorsementsTable.cred}), 0) AS cred
      FROM ${endorsementsTable}
      GROUP BY 
          point_id
  ) e ON points.id = e.point_id`;

  if (viewerId !== null)
    query.append(sql`
    LEFT JOIN (
        SELECT 
            ${endorsementsTable.pointId},
            COALESCE(SUM(${endorsementsTable.cred}), 0) AS viewer_cred
        FROM ${endorsementsTable}
        WHERE ${eq(endorsementsTable.userId, viewerId)}
        GROUP BY 
            point_id
    ) v ON points.id = v.point_id
    `).append;

  query.append(sql`
  WHERE ${eq(pointCounterpointsJoinView.pointId, id)}
  `);

  query.inlineParams();

  return await db.execute(query).then((negations) =>
    negations.map(
      ({
        created_at,
        created_by,
        negation_count,
        cred,
        viewer_cred,
        amount_suporters,
        point_id,
        content,
        ...point
      }) => ({
        createdAt: new Date(created_at as string),
        createdBy: created_by as string,
        amountNegations: Number(negation_count),
        cred: Number(cred),
        viewerCred: viewer_cred ? Number(viewer_cred) : undefined,
        amountSupporters: Number(amount_suporters),
        id: Number(point_id),
        content: content as string,
        ...point,
      })
    )
  );
};