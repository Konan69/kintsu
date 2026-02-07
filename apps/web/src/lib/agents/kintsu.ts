import { tool, embed } from "ai";
import { z } from "zod";
import type { UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@kintsu/backend/convex/_generated/api";

// Initialize clients
const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || "";
const convex = new ConvexHttpClient(convexUrl);

// System prompt for Kintsu
export const systemPrompt = `You are Kintsu, a warm and knowledgeable companion helping users understand their attachment patterns and communicate better with their partners.

You understand attachment theory deeply - the anxious, avoidant, and secure attachment styles, and how they interact in relationships. You recognize patterns like:

**Avoidant patterns:**
- Deactivating strategies (minimizing importance of relationships, distancing)
- Shutting down during emotional conversations
- Feeling suffocated by partner's needs
- Deflecting emotional topics
- Withdrawal when overwhelmed
- Needing excessive space or independence
- Difficulty expressing emotions or needs
- Idealizing past relationships or phantom exes
- Focusing on partner's flaws to create distance
- Feeling trapped or losing freedom

**Anxious patterns:**
- Protest behaviors (trying to get partner's attention)
- Hyperactivation (amplifying attachment needs)
- Seeking constant reassurance
- Fear of abandonment
- Difficulty with partner's independence
- Ruminating about relationship
- Taking things personally
- Hypervigilance to partner's moods
- Difficulty self-soothing
- Roller coaster of emotions

**Your approach:**
- Adapt your tone based on the emotional state you sense in the user
- Recognize patterns naturally from what they share - you don't always need to name them explicitly
- Offer concrete scripts and phrases when the user seems stuck on how to communicate
- Never lecture - be alongside them, not above them
- Help them understand their triggers and responses with compassion
- Use the queryKnowledge tool when you need specific attachment theory concepts or examples
- Use the recallMemory tool when you need to remember past conversations or user details
- Use the saveMemory tool when the user says "remember this," makes a correction, or shares something you should not forget

**Response style:**
- Sometimes gentle and validating: "That sounds really hard..."
- Sometimes direct and educational: "What you're describing is a classic deactivating strategy..."
- Sometimes curious and exploratory: "I'm curious, what do you think triggered that response?"
- Let the conversation guide which approach you take

**When offering communication scripts:**
- Provide specific, usable phrases the user can actually say
- Explain why each phrase works from an attachment perspective
- Offer alternatives for different comfort levels

Remember: The goal is not to "fix" them but to help them understand themselves and communicate more effectively with their partner.`;

/**
 * Generate embedding for a query text
 */
async function getEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
    providerOptions: {
      openai: { dimensions: 1536 },
    },
  });
  return embedding;
}

// Tool definitions
export const kintsuTools = {
  queryKnowledge: tool({
    description:
      "Look up attachment theory concepts, patterns, strategies, or communication techniques from the knowledge base (the 'Attached' book)",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The concept or topic to look up, e.g., 'deactivating strategies' or 'protest behaviors' or 'anxious-avoidant trap'"
        ),
    }),
    execute: async ({ query }: { query: string }) => {
      try {
        // Generate embedding for the query
        const embedding = await getEmbedding(query);

        // Search Convex knowledge base
        const results = await convex.action(api.knowledge.searchKnowledge, {
          embedding,
          includeBookChunks: true,
          includeConcepts: true,
          limit: 5,
        });

        if (
          results.bookChunks.length === 0 &&
          results.concepts.length === 0
        ) {
          return {
            found: false,
            query,
            message:
              "No relevant knowledge found. The knowledge base may not be ingested yet.",
          };
        }

        // Format results for the agent
        const formattedChunks = results.bookChunks.map((chunk: Record<string, unknown>) => ({
          content: chunk.content,
          section: chunk.sourceSection || "Unknown section",
          relevance: chunk.score,
        }));

        const formattedConcepts = results.concepts.map((concept: Record<string, unknown>) => ({
          name: concept.name,
          description: concept.description,
          category: concept.category,
          examples: concept.examples,
        }));

        return {
          found: true,
          query,
          bookExcerpts: formattedChunks,
          concepts: formattedConcepts,
          linkedConcepts: results.linkedConcepts,
        };
      } catch (error) {
        console.error("Knowledge search error:", error);
        return {
          found: false,
          query,
          error: "Failed to search knowledge base",
        };
      }
    },
  }),

  saveMemory: tool({
    description:
      "Save important information immediately — corrections, explicit 'remember this' requests, critical updates about the user or their relationship",
    inputSchema: z.object({
      content: z
        .string()
        .describe("The fact or information to remember, written as a clear standalone statement"),
      type: z
        .enum(["episodic", "semantic", "procedural"])
        .describe("Memory type: episodic (specific event), semantic (general fact), procedural (strategy/technique)"),
      keywords: z
        .array(z.string())
        .optional()
        .describe("Keywords for this memory"),
      userId: z
        .string()
        .optional()
        .describe("The user ID to save the memory for"),
    }),
    execute: async ({
      content,
      type,
      keywords,
      userId,
    }: {
      content: string;
      type: "episodic" | "semantic" | "procedural";
      keywords?: string[];
      userId?: string;
    }) => {
      try {
        if (!userId) {
          return {
            saved: false,
            message: "No user context available. Memory saving requires an active user session.",
          };
        }

        const result = await convex.action(api.memories.addFromTool, {
          userId: userId as any,
          content,
          type,
          keywords,
        });

        if (result.success) {
          return {
            saved: true,
            memoryId: result.memoryId,
            message: `Saved: "${content}"`,
          };
        } else {
          return {
            saved: false,
            reason: result.reason,
            message: "This information is already saved.",
          };
        }
      } catch (error) {
        console.error("Save memory error:", error);
        return {
          saved: false,
          error: "Failed to save memory",
        };
      }
    },
  }),

  recallMemory: tool({
    description:
      "Recall relevant memories and context about the user, their partner, or their relationship history from past conversations",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "What to recall, e.g., 'partner information' or 'recent arguments' or 'user attachment style'"
        ),
      userId: z
        .string()
        .optional()
        .describe("The user ID to search memories for"),
    }),
    execute: async ({ query, userId }: { query: string; userId?: string }) => {
      try {
        // For now, memories require a userId
        // In a full implementation, the userId would come from the session
        if (!userId) {
          return {
            found: false,
            query,
            message:
              "No user context available. Memory search requires an active user session.",
          };
        }

        // Generate embedding for the query
        const embedding = await getEmbedding(query);

        // Search memories
        const memories = await convex.action(api.memories.search, {
          userId: userId as any, // Cast to Id type
          embedding,
          limit: 5,
        });

        if (memories.length === 0) {
          return {
            found: false,
            query,
            message: "No relevant memories found for this user.",
          };
        }

        // Format memories for the agent
        const formattedMemories = memories.map((memory: Record<string, unknown>) => ({
          content: memory.content,
          type: memory.type,
          keywords: memory.keywords,
          relevance: memory.score,
        }));

        return {
          found: true,
          query,
          memories: formattedMemories,
        };
      } catch (error) {
        console.error("Memory search error:", error);
        return {
          found: false,
          query,
          error: "Failed to search memories",
        };
      }
    },
  }),
};

// Export type for useChat
export type KintsuUIMessage = UIMessage;
