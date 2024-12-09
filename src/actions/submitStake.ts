'use server'

import { db } from "@/services/db";
import { restakesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function submitStake(
  pointId: number, 
  negationId: number, 
  userId: string,
  amount: number
) {
  // First check if there's an existing stake
  const [existingStake] = await db
    .select()
    .from(restakesTable)
    .where(
      and(
        eq(restakesTable.pointId, pointId),
        eq(restakesTable.negationId, negationId),
        eq(restakesTable.userId, userId)
      )
    );

  if (existingStake) {
    // Update existing stake
    return await db
      .update(restakesTable)
      .set({ 
        amount,
        updatedAt: new Date(),
        status: 'active'
      })
      .where(eq(restakesTable.id, existingStake.id));
  } else {
    // Create new stake
    return await db.insert(restakesTable).values({
      pointId,
      negationId,
      userId,
      amount,
      status: 'active'
    });
  }
} 