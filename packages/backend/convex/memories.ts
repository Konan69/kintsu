import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { generateObject, embed } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// ============================================
// AI SDK Configuration
// ============================================

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================
// Memory Extraction Prompts
// ============================================

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction system for Kintsu, a relationship coaching AI specialized in attachment theory.

Extract important facts, observations, and insights from conversations. Focus on:

1. **User Information**: Name, emotional state, attachment patterns, personal details
2. **Partner Information**: Name, behaviors, attachment style indicators
3. **Relationship Dynamics**: Interaction patterns, conflicts, positive moments
4. **Emotional Triggers**: What causes anxiety, withdrawal, or conflict escalation
5. **Communication Insights**: Effective/ineffective communication patterns observed
6. **Growth & Progress**: Behavioral changes, new understandings, breakthroughs

Classify each extracted memory:
- **episodic**: A specific event or moment ("Had an argument about finances last week")
- **semantic**: A generalizable fact ("Partner tends to shut down during emotional conversations")
- **procedural**: A strategy or technique that works ("Using 'I feel' statements helps de-escalate conflicts")

Also determine if any information should update the always-available core memory blocks:
- **user_profile**: Fundamental facts about the user (name, age, background, attachment style)
- **partner_info**: Fundamental facts about their partner
- **relationship_context**: Overall relationship situation and dynamics
- **preferences**: How the user wants to be supported by Kintsu

IMPORTANT: Only extract from USER messages and the assistant's direct observations about the user. Do not fabricate information. Be concise but complete. If the conversation is just greetings or small talk, return empty arrays.`;

const DECISION_SYSTEM_PROMPT = `You are a memory deduplication system. Compare new memories against existing similar memories and decide the right operation.

Operations:
- **ADD**: Genuinely new information not captured by any existing memory
- **UPDATE**: An existing memory should be enhanced or corrected with new information. Provide the merged text and the target existing memory ID.
- **INVALIDATE**: An existing memory is now contradicted or outdated. Provide the target ID.
- **NOOP**: Information already adequately captured by existing memories.

Guidelines:
- Choose NOOP if semantically equivalent even if worded differently
- Choose UPDATE if the new memory adds meaningful detail to an existing one — merge into one comprehensive statement
- Choose INVALIDATE if new info directly contradicts old, then ADD the corrected version as a separate decision
- Choose ADD only for genuinely new information with no semantic overlap
- Be conservative — prefer NOOP/UPDATE over ADD to avoid memory duplication
- Every decision MUST have a new_memory_index that corresponds to a memory from the input list`;

// ============================================
// Zod Schemas for Structured LLM Output
// ============================================

const extractionSchema = z.object({
  memories: z.array(
    z.object({
      content: z.string().describe("Clear, standalone fact or observation"),
      type: z.enum(["episodic", "semantic", "procedural"]),
      keywords: z.array(z.string()),
    })
  ),
  core_memory_updates: z.array(
    z.object({
      label: z.enum([
        "user_profile",
        "partner_info",
        "relationship_context",
        "preferences",
      ]),
      content: z
        .string()
        .describe(
          "Full updated content for this block, merging existing and new info"
        ),
    })
  ),
});

const decisionSchema = z.object({
  decisions: z.array(
    z.object({
      new_memory_index: z.number(),
      action: z.enum(["ADD", "UPDATE", "INVALIDATE", "NOOP"]),
      content: z
        .string()
        .optional()
        .describe("Memory text (required for ADD and UPDATE)"),
      target_memory_id: z
        .string()
        .optional()
        .describe("Existing memory ID (required for UPDATE and INVALIDATE)"),
      reason: z.string(),
    })
  ),
});

type ExtractedMemory = z.infer<typeof extractionSchema>["memories"][number];
type MemoryDecision = z.infer<typeof decisionSchema>["decisions"][number];

// ============================================
// Helpers
// ============================================

async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
    providerOptions: {
      openai: { dimensions: 1536 },
    },
  });
  return embedding;
}

// Queue a conversation for memory processing (sleep-time compute)
export const queueForProcessing = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    // Check if already queued
    const existing = await ctx.db
      .query("memoryQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.eq(q.field("conversationId"), args.conversationId))
      .first();

    if (!existing) {
      await ctx.db.insert("memoryQueue", {
        userId: args.userId,
        conversationId: args.conversationId,
        status: "pending",
        createdAt: Date.now(),
      });

      // Schedule processing
      await ctx.scheduler.runAfter(
        5000, // 5 second delay to batch messages
        internal.memories.processQueue,
        {}
      );
    }
  },
});

// Process pending memory queue items
export const processQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.runQuery(internal.memories.getPendingQueue, {});

    for (const item of pending) {
      try {
        await ctx.runMutation(internal.memories.markProcessing, {
          queueId: item._id,
        });

        // Get conversation messages
        const messages = await ctx.runQuery(internal.memories.getConversationMessages, {
          conversationId: item.conversationId,
        });

        if (messages.length > 0) {
          // Process memories (this would call the LLM in production)
          await ctx.runAction(internal.memories.extractAndStoreMemories, {
            userId: item.userId,
            conversationId: item.conversationId,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          });
        }

        await ctx.runMutation(internal.memories.markCompleted, {
          queueId: item._id,
        });
      } catch (error) {
        await ctx.runMutation(internal.memories.markFailed, {
          queueId: item._id,
        });
      }
    }
  },
});

export const getPendingQueue = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("memoryQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(10);
  },
});

export const getConversationMessages = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const markProcessing = internalMutation({
  args: { queueId: v.id("memoryQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, { status: "processing" });
  },
});

export const markCompleted = internalMutation({
  args: { queueId: v.id("memoryQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "completed",
      processedAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: { queueId: v.id("memoryQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, { status: "failed" });
  },
});

// Extract and store memories from conversation (sleep-time agent)
export const extractAndStoreMemories = internalAction({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Step 1: Fetch current core memory blocks for context
    const coreMemory = await ctx.runQuery(
      internal.memories.getCoreMemoryBlocks,
      { userId: args.userId }
    );

    const coreMemoryText = coreMemory
      .map(
        (block: { label: string; content: string }) =>
          `[${block.label}]: ${block.content || "(empty)"}`
      )
      .join("\n");

    // Step 2: Format conversation
    const conversationText = args.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    // Step 3: Extract memories via LLM
    const extractionPrompt = `Current core memory blocks:\n${coreMemoryText}\n\nConversation to process:\n${conversationText}\n\nExtract memories and any core memory updates. Respond with JSON:\n{\n  "memories": [\n    {\n      "content": "Clear, standalone fact or observation",\n      "type": "episodic|semantic|procedural",\n      "keywords": ["keyword1", "keyword2"]\n    }\n  ],\n  "core_memory_updates": [\n    {\n      "label": "user_profile|partner_info|relationship_context|preferences",\n      "content": "Full updated content for this block, merging existing and new info"\n    }\n  ]\n}`;

    let extraction: z.infer<typeof extractionSchema>;
    try {
      const { object } = await generateObject({
        model: openrouter.chat("moonshotai/kimi-k2.5"),
        schema: extractionSchema,
        system: EXTRACTION_SYSTEM_PROMPT,
        prompt: extractionPrompt,
        temperature: 0,
      });
      extraction = object;
    } catch (error) {
      console.error("Memory extraction failed:", error);
      return;
    }

    const hasMemories = extraction.memories && extraction.memories.length > 0;
    const hasCoreUpdates =
      extraction.core_memory_updates &&
      extraction.core_memory_updates.length > 0;

    if (!hasMemories && !hasCoreUpdates) {
      return;
    }

    // Step 4: Apply core memory block updates
    const validLabels = [
      "user_profile",
      "partner_info",
      "relationship_context",
      "preferences",
    ];
    for (const update of extraction.core_memory_updates || []) {
      if (validLabels.includes(update.label)) {
        await ctx.runMutation(internal.memories.updateCoreMemoryInternal, {
          userId: args.userId,
          label: update.label as
            | "user_profile"
            | "partner_info"
            | "relationship_context"
            | "preferences",
          content: update.content,
        });
      }
    }

    if (!hasMemories) {
      return;
    }

    // Step 5: For each extracted memory, generate embedding and find similar existing ones
    const memoriesWithContext: Array<{
      memory: ExtractedMemory;
      embedding: number[];
      similar: Array<{
        _id: string;
        content: string;
        type: string;
        score: number;
      }>;
    }> = [];

    for (const memory of extraction.memories) {
      try {
        const embedding = await generateEmbedding(memory.content);

        const searchResults = await ctx.vectorSearch(
          "memories",
          "by_embedding",
          {
            vector: embedding,
            limit: 5,
            filter: (q) => q.eq("userId", args.userId),
          }
        );

        const similar: Array<{
          _id: string;
          content: string;
          type: string;
          score: number;
        }> = [];
        for (const result of searchResults) {
          const full = await ctx.runQuery(internal.memories.getById, {
            memoryId: result._id,
          });
          if (full && !full.invalidAt) {
            similar.push({
              _id: full._id,
              content: full.content,
              type: full.type,
              score: result._score,
            });
          }
        }

        memoriesWithContext.push({ memory, embedding, similar });
      } catch (error) {
        console.error(
          `Failed to process memory "${memory.content}":`,
          error
        );
      }
    }

    if (memoriesWithContext.length === 0) return;

    // Step 6: Decide operations via LLM (or skip if no existing memories to compare)
    const newMemoriesForPrompt = memoriesWithContext.map((m, i) => ({
      index: i,
      content: m.memory.content,
      type: m.memory.type,
    }));

    // Collect and deduplicate all existing similar memories
    const existingByID: Record<
      string,
      { id: string; content: string; type: string; similarity: number }
    > = {};
    for (const m of memoriesWithContext) {
      for (const s of m.similar) {
        existingByID[s._id] = {
          id: s._id,
          content: s.content,
          type: s.type,
          similarity: s.score,
        };
      }
    }
    const uniqueExisting = Object.values(existingByID);

    let decisions: MemoryDecision[];

    if (uniqueExisting.length === 0) {
      // No existing memories to compare — ADD everything
      decisions = memoriesWithContext.map((m, i) => ({
        new_memory_index: i,
        action: "ADD" as const,
        content: m.memory.content,
        reason: "No similar existing memories found",
      }));
    } else {
      // Ask LLM to decide
      const decisionPrompt = `New memories to evaluate:\n${JSON.stringify(newMemoriesForPrompt, null, 2)}\n\nExisting similar memories in the database:\n${JSON.stringify(uniqueExisting, null, 2)}\n\nFor each new memory (by index), decide: ADD, UPDATE, INVALIDATE, or NOOP.\nRespond with JSON:\n{\n  "decisions": [\n    {\n      "new_memory_index": 0,\n      "action": "ADD|UPDATE|INVALIDATE|NOOP",\n      "content": "Memory text (required for ADD and UPDATE)",\n      "target_memory_id": "existing memory ID (required for UPDATE and INVALIDATE)",\n      "reason": "Brief explanation"\n    }\n  ]\n}`;

      try {
        const { object } = await generateObject({
          model: openrouter.chat("moonshotai/kimi-k2.5"),
          schema: decisionSchema,
          system: DECISION_SYSTEM_PROMPT,
          prompt: decisionPrompt,
          temperature: 0,
        });
        decisions = object.decisions;
      } catch (error) {
        console.error("Memory decision LLM failed, defaulting to ADD:", error);
        decisions = memoriesWithContext.map((m, i) => ({
          new_memory_index: i,
          action: "ADD" as const,
          content: m.memory.content,
          reason: "Decision LLM call failed, defaulting to ADD",
        }));
      }
    }

    // Step 7: Execute decisions
    for (const decision of decisions) {
      const entry = memoriesWithContext[decision.new_memory_index];
      if (!entry) continue;

      try {
        switch (decision.action) {
          case "ADD": {
            const content = decision.content || entry.memory.content;
            // Re-embed only if the LLM rewrote the content
            const embedding =
              content !== entry.memory.content
                ? await generateEmbedding(content)
                : entry.embedding;

            await ctx.runMutation(internal.memories.addInternal, {
              userId: args.userId,
              content,
              embedding,
              type: entry.memory.type,
              keywords: entry.memory.keywords,
              sourceConversationId: args.conversationId,
            });
            break;
          }

          case "UPDATE": {
            if (decision.target_memory_id && decision.content) {
              // Invalidate the old memory (temporal validity model)
              await ctx.runMutation(internal.memories.invalidateInternal, {
                memoryId: decision.target_memory_id as any,
              });
              // Add the updated/merged version
              const embedding = await generateEmbedding(decision.content);
              await ctx.runMutation(internal.memories.addInternal, {
                userId: args.userId,
                content: decision.content,
                embedding,
                type: entry.memory.type,
                keywords: entry.memory.keywords,
                sourceConversationId: args.conversationId,
              });
            }
            break;
          }

          case "INVALIDATE": {
            if (decision.target_memory_id) {
              await ctx.runMutation(internal.memories.invalidateInternal, {
                memoryId: decision.target_memory_id as any,
              });
            }
            break;
          }

          case "NOOP":
            break;
        }
      } catch (error) {
        console.error(
          `Failed to execute ${decision.action} for memory ${decision.new_memory_index}:`,
          error
        );
      }
    }

    console.log(
      `Memory processing complete for user ${args.userId}: ` +
        `${extraction.memories.length} extracted, ${decisions.length} decisions executed`
    );
  },
});

// Add a new memory
export const add = mutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
    embedding: v.array(v.float64()),
    type: v.union(
      v.literal("episodic"),
      v.literal("semantic"),
      v.literal("procedural")
    ),
    keywords: v.optional(v.array(v.string())),
    sourceConversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("memories", {
      userId: args.userId,
      content: args.content,
      embedding: args.embedding,
      type: args.type,
      keywords: args.keywords,
      sourceConversationId: args.sourceConversationId,
      validAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

// Invalidate a memory (temporal validity)
export const invalidate = mutation({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      invalidAt: Date.now(),
    });
  },
});

// Search memories by vector similarity
export const search = action({
  args: {
    userId: v.id("users"),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Record<string, unknown>>> => {
    const limit = args.limit ?? 10;

    const results = await ctx.vectorSearch("memories", "by_embedding", {
      vector: args.embedding,
      limit,
      filter: (q) => q.eq("userId", args.userId),
    });

    // Filter out invalidated memories
    const validMemories: Array<Record<string, unknown>> = [];
    for (const result of results) {
      const memory: Record<string, unknown> | null = await ctx.runQuery(internal.memories.getById, {
        memoryId: result._id,
      });
      if (memory && !memory.invalidAt) {
        validMemories.push({ ...memory, score: result._score });
      }
    }

    return validMemories;
  },
});

export const getById = internalQuery({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memoryId);
  },
});

// Get all valid memories for a user (for debugging/admin)
export const listValid = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memories")
      .withIndex("by_user_valid", (q) =>
        q.eq("userId", args.userId).eq("invalidAt", undefined)
      )
      .collect();
  },
});

// ============================================
// Internal mutations for extractAndStoreMemories
// ============================================

export const addInternal = internalMutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
    embedding: v.array(v.float64()),
    type: v.union(
      v.literal("episodic"),
      v.literal("semantic"),
      v.literal("procedural")
    ),
    keywords: v.optional(v.array(v.string())),
    sourceConversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("memories", {
      userId: args.userId,
      content: args.content,
      embedding: args.embedding,
      type: args.type,
      keywords: args.keywords,
      sourceConversationId: args.sourceConversationId,
      validAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const invalidateInternal = internalMutation({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      invalidAt: Date.now(),
    });
  },
});

export const getCoreMemoryBlocks = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("coreMemoryBlocks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const updateCoreMemoryInternal = internalMutation({
  args: {
    userId: v.id("users"),
    label: v.union(
      v.literal("user_profile"),
      v.literal("partner_info"),
      v.literal("relationship_context"),
      v.literal("preferences")
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coreMemoryBlocks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("label"), args.label))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        updatedAt: Date.now(),
      });
    }
  },
});
