"use server";

import { embeddingsTable, Point, pointsTable } from "@/db/schema";
import { db } from "@/services/db";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { desc, eq, gt, innerProduct, sql } from "drizzle-orm";

export const fetchSimilarPoints = async ({
  query,
}: {
  query: string;
}): Promise<Point[]> => {
  const embedding = (
    await embed({
      model: openai.embedding("text-embedding-3-small", { dimensions: 384 }),
      value: query,
    })
  ).embedding;

  const similarity = sql<number>`1 - (${innerProduct(embeddingsTable.embedding, embedding)})`;

  return await db
    .select({
      similarity,
      id: pointsTable.id,
      content: pointsTable.content,
      createdAt: pointsTable.createdAt,
      createdBy: pointsTable.createdBy,
    })
    .from(embeddingsTable)
    .innerJoin(pointsTable, eq(pointsTable.id, embeddingsTable.id))
    .where(gt(similarity, 0.5))
    .orderBy((t) => desc(t.similarity))
    .limit(5);
};
