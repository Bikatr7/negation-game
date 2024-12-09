'use server'

import { db } from "@/services/db";
import { doubtsTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function submitDoubt(
  pointId: number,
  negationId: number,
  userId: string,
  amount: number
) {
  // First check if there's an existing doubt
  const [existingDoubt] = await db
    .select()
    .from(doubtsTable)
    .where(
      and(
        eq(doubtsTable.pointId, pointId),
        eq(doubtsTable.negationId, negationId),
        eq(doubtsTable.userId, userId)
      )
    );

  if (existingDoubt) {
    // Update existing doubt
    return await db
      .update(doubtsTable)
      .set({ 
        amount,
        status: 'active'
      })
      .where(eq(doubtsTable.id, existingDoubt.id));
  } else {
    // Create new doubt
    return await db.insert(doubtsTable).values({
      pointId,
      negationId,
      userId,
      amount,
      status: 'active'
    });
  }
} 