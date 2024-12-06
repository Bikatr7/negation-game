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

type ResponseType = {
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

export const chat = async (
  messages: { role: "assistant" | "user"; content: string }[], 
  isOnboarding: boolean
): Promise<ReadableStream<ChatResponse>> => {
  const lastMessage = messages[messages.length - 1];
  
  // Always fetch points - let the AI decide if they're relevant
  const similarPoints = await fetchSimilarPoints({ query: lastMessage.content });

  const prompt = `You are an AI assistant helping users find and create points in a discussion platform called Negation Game.

Context:
- Users can endorse or negate points by staking their cred
- Feel free to suggest relevant points whenever you think they might be helpful
- Always ask if they'd like to discuss the points you suggest
${isOnboarding ? '- This is the user\'s first conversation - be extra helpful explaining concepts' : ''}
${similarPoints.length > 0 ? `
Available points to suggest:
${similarPoints.map(p => `ID ${p.pointId}: ${p.content}`).join('\n')}
` : ''}

Previous messages:
${messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

User's last message: ${lastMessage.content}

${isOnboarding 
  ? 'Be extra welcoming and helpful, explaining concepts clearly when they come up.' 
  : 'Respond naturally and suggest points when you think they\'re relevant.'}

When suggesting points:
1. Only use points from the "Available points" list
2. Feel free to suggest points that are thematically related, even if not exact keyword matches
3. Introduce them conversationally (e.g. "That reminds me of some interesting points in our system. Would you like to discuss them?")
4. Include their IDs in the suggestedPoints field of your response
5. Keep point descriptions brief - users can see the details themselves

Available points data to include in response:
${JSON.stringify(similarPoints)}`;

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
    }).transform(response => {
      if (response.suggestedPoints) {
        response.suggestedPoints = response.suggestedPoints.filter(point => 
          similarPoints.some(sp => sp.pointId === point.pointId)
        );
      }
      return response;
    }),
    prompt
  });

  return elementStream;
}; 