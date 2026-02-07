import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users
  users: defineTable({
    attachmentStyle: v.union(v.literal("anxious"), v.literal("avoidant")),
    createdAt: v.number(),
  }),

  // Conversations
  conversations: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Messages
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Core Memory Blocks (always injected into context)
  coreMemoryBlocks: defineTable({
    userId: v.id("users"),
    label: v.union(
      v.literal("user_profile"),
      v.literal("partner_info"),
      v.literal("relationship_context"),
      v.literal("preferences")
    ),
    content: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Long-Term Memories (retrieved on-demand via vector search)
  memories: defineTable({
    userId: v.id("users"),
    content: v.string(),
    embedding: v.array(v.float64()),
    type: v.union(
      v.literal("episodic"),
      v.literal("semantic"),
      v.literal("procedural")
    ),
    keywords: v.optional(v.array(v.string())),
    contentHash: v.optional(v.string()),
    validAt: v.optional(v.number()),
    invalidAt: v.optional(v.number()),
    sourceConversationId: v.optional(v.id("conversations")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_valid", ["userId", "invalidAt"])
    .index("by_content_hash", ["userId", "contentHash"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId", "invalidAt"],
    }),

  // Memory Links (A-MEM style connections)
  memoryLinks: defineTable({
    fromMemoryId: v.id("memories"),
    toMemoryId: v.id("memories"),
    relationship: v.string(),
    createdAt: v.number(),
  })
    .index("by_from", ["fromMemoryId"])
    .index("by_to", ["toMemoryId"]),

  // Memory Processing Queue (sleep-time compute)
  memoryQueue: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  // Knowledge: Book Chunks (RAG)
  bookChunks: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    sourceSection: v.optional(v.string()),
    pageRef: v.optional(v.string()),
    createdAt: v.number(),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
  }),

  // Knowledge: Concepts
  concepts: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("attachment_style"),
      v.literal("behavior"),
      v.literal("strategy"),
      v.literal("trigger"),
      v.literal("communication")
    ),
    examples: v.optional(v.array(v.string())),
    embedding: v.array(v.float64()),
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
    }),

  // Knowledge: Concept Links
  conceptLinks: defineTable({
    fromConceptId: v.id("concepts"),
    toConceptId: v.id("concepts"),
    relationship: v.union(
      v.literal("is_type_of"),
      v.literal("causes"),
      v.literal("contrasts_with"),
      v.literal("related_to"),
      v.literal("leads_to")
    ),
    createdAt: v.number(),
  })
    .index("by_from", ["fromConceptId"])
    .index("by_to", ["toConceptId"]),

  // Memory Audit Log (decision trail for debugging)
  memoryAudit: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    action: v.union(
      v.literal("ADD"),
      v.literal("UPDATE"),
      v.literal("INVALIDATE"),
      v.literal("NOOP"),
      v.literal("HASH_DUPLICATE")
    ),
    reason: v.string(),
    memoryId: v.optional(v.id("memories")),
    targetMemoryId: v.optional(v.id("memories")),
    memoryContent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"]),
});
