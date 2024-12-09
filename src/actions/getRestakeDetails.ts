'use server'

import { db } from "@/services/db";
import { restakeDetailsView } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getRestakeDetails(pointId: number) {
  return db.select()
    .from(restakeDetailsView)
    .where(eq(restakeDetailsView.pointId, pointId))
    .limit(1);
} 