"use server";

import { fetchSimilarPoints } from "@/actions/fetchSimilarPoints";
import { google } from "@ai-sdk/google";
import { streamObject } from "ai";
import { z } from "zod";

export type ChatResponse = {
  content: string;
  suggestedPoints?: Array<{
    pointId: number;
    content: string;
    cred: number;
    favor: number;
    amountSupporters: number;
    amountNegations: number;
  }>;
  action?: "suggest_points" | "create_point" | "none";
};

export const chat = async (messages: { role: "assistant" | "user"; content: string }[]): Promise<ReadableStream<ChatResponse>> => {
  const lastMessage = messages[messages.length - 1];
  
  // Get similar points to help inform the AI response
  const similarPoints = await fetchSimilarPoints({ query: lastMessage.content });

  const prompt = `You are an AI assistant helping users find and create points in a discussion platform.

Context:
- Users can endorse existing points or create new ones
- Each point can be supported or negated with "cred" (a form of reputation)
${similarPoints.length > 0 ? `
Related existing points:
${similarPoints.map(p => `- ${p.content} (${p.amountSupporters} supporters)`).join('\n')}
` : ''}

Previous messages:
${messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

User's last message: ${lastMessage.content}

Respond naturally and suggest relevant points when appropriate. If suggesting points, include their IDs so they can be endorsed.`;

  const { elementStream } = await streamObject({
    model: google("gemini-1.5-flash"),
    output: "array",
    schema: z.object({
      content: z.string(),
      suggestedPoints: z.array(z.object({
        pointId: z.number(),
        content: z.string(),
        cred: z.number(),
        favor: z.number(),
        amountSupporters: z.number(),
        amountNegations: z.number()
      })).optional(),
      action: z.enum(["suggest_points", "create_point", "none"]).optional()
    }),
    prompt
  });

  return elementStream;
}; 