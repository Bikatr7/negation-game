'use server'

import { db } from "@/services/db";
import { slashingEventsTable, restakesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function submitSlash(
  restakeId: number,
  userId: string,
  amount: number,
  reason?: string
) {
  // Start a transaction
  return await db.transaction(async (tx) => {
    // Update restake status
    await tx
      .update(restakesTable)
      .set({ 
        status: 'slashed',
        updatedAt: new Date()
      })
      .where(eq(restakesTable.id, restakeId));

    // Create slashing event
    return await tx.insert(slashingEventsTable).values({
      restakeId,
      userId,
      amount,
      reason
    });
  });
} 