'use server'

import { db } from "@/services/db";
import { restakesTable, doubtsTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function getStakeInfo(pointId: number, negationId: number, userId: string) {
  const [restakeInfo] = await db
    .select({
      id: restakesTable.id,
      amount: restakesTable.amount,
      status: restakesTable.status
    })
    .from(restakesTable)
    .where(
      and(
        eq(restakesTable.pointId, pointId),
        eq(restakesTable.negationId, negationId),
        eq(restakesTable.userId, userId),
        eq(restakesTable.status, 'active')
      )
    );

  const [doubtInfo] = await db
    .select({
      amount: doubtsTable.amount,
      status: doubtsTable.status
    })
    .from(doubtsTable)
    .where(
      and(
        eq(doubtsTable.pointId, pointId),
        eq(doubtsTable.negationId, negationId),
        eq(doubtsTable.userId, userId),
        eq(doubtsTable.status, 'active')
      )
    );

  return {
    stakeId: restakeInfo?.id,
    stakedAmount: restakeInfo?.amount ?? 0,
    doubtAmount: doubtInfo?.amount ?? 0,
    stakeStatus: restakeInfo?.status,
    doubtStatus: doubtInfo?.status
  };
} 