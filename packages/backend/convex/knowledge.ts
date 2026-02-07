import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Add a book chunk
export const addBookChunk = mutation({
  args: {
    content: v.string(),
    embedding: v.array(v.float64()),
    sourceSection: v.optional(v.string()),
    pageRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookChunks", {
      content: args.content,
      embedding: args.embedding,
      sourceSection: args.sourceSection,
      pageRef: args.pageRef,
      createdAt: Date.now(),
    });
  },
});

// Batch add book chunks
export const addBookChunksBatch = mutation({
  args: {
    chunks: v.array(
      v.object({
        content: v.string(),
        embedding: v.array(v.float64()),
        sourceSection: v.optional(v.string()),
        pageRef: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const chunk of args.chunks) {
      const id = await ctx.db.insert("bookChunks", {
        content: chunk.content,
        embedding: chunk.embedding,
        sourceSection: chunk.sourceSection,
        pageRef: chunk.pageRef,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

// Search book chunks by vector similarity
export const searchBookChunks = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Record<string, unknown>>> => {
    const limit = args.limit ?? 5;

    const results = await ctx.vectorSearch("bookChunks", "by_embedding", {
      vector: args.embedding,
      limit,
    });

    const chunks: Array<Record<string, unknown>> = [];
    for (const result of results) {
      const chunk: Record<string, unknown> | null = await ctx.runQuery(internal.knowledge.getBookChunkById, {
        chunkId: result._id,
      });
      if (chunk) {
        chunks.push({ ...chunk, score: result._score });
      }
    }

    return chunks;
  },
});

export const getBookChunkById = internalQuery({
  args: { chunkId: v.id("bookChunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chunkId);
  },
});

// Add a concept
export const addConcept = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("concepts", {
      name: args.name,
      description: args.description,
      category: args.category,
      examples: args.examples,
      embedding: args.embedding,
      createdAt: Date.now(),
    });
  },
});

// Link two concepts
export const linkConcepts = mutation({
  args: {
    fromConceptId: v.id("concepts"),
    toConceptId: v.id("concepts"),
    relationship: v.union(
      v.literal("is_type_of"),
      v.literal("causes"),
      v.literal("contrasts_with"),
      v.literal("related_to"),
      v.literal("leads_to")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conceptLinks", {
      fromConceptId: args.fromConceptId,
      toConceptId: args.toConceptId,
      relationship: args.relationship,
      createdAt: Date.now(),
    });
  },
});

// Search concepts by vector similarity
export const searchConcepts = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Record<string, unknown>>> => {
    const limit = args.limit ?? 5;

    const results = await ctx.vectorSearch("concepts", "by_embedding", {
      vector: args.embedding,
      limit,
    });

    const concepts: Array<Record<string, unknown>> = [];
    for (const result of results) {
      const concept: Record<string, unknown> | null = await ctx.runQuery(internal.knowledge.getConceptById, {
        conceptId: result._id,
      });
      if (concept) {
        concepts.push({ ...concept, score: result._score });
      }
    }

    return concepts;
  },
});

export const getConceptById = internalQuery({
  args: { conceptId: v.id("concepts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conceptId);
  },
});

// Get linked concepts (multi-hop)
export const getLinkedConcepts = query({
  args: {
    conceptId: v.id("concepts"),
    depth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const depth = args.depth ?? 1;
    const visited = new Set<string>();
    const result: Array<{
      concept: Awaited<ReturnType<typeof ctx.db.get>>;
      relationship: string;
      distance: number;
    }> = [];

    async function traverse(id: string, currentDepth: number) {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const links = await ctx.db
        .query("conceptLinks")
        .withIndex("by_from", (q) => q.eq("fromConceptId", id as any))
        .collect();

      for (const link of links) {
        const concept = await ctx.db.get(link.toConceptId);
        if (concept && !visited.has(link.toConceptId)) {
          result.push({
            concept,
            relationship: link.relationship,
            distance: currentDepth,
          });
          await traverse(link.toConceptId, currentDepth + 1);
        }
      }
    }

    await traverse(args.conceptId, 1);
    return result;
  },
});

// Get all concepts by category
export const listByCategory = query({
  args: {
    category: v.union(
      v.literal("attachment_style"),
      v.literal("behavior"),
      v.literal("strategy"),
      v.literal("trigger"),
      v.literal("communication")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("concepts")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

// Combined knowledge search (book + concepts + links)
export const searchKnowledge = action({
  args: {
    embedding: v.array(v.float64()),
    includeBookChunks: v.optional(v.boolean()),
    includeConcepts: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    bookChunks: Array<Record<string, unknown>>;
    concepts: Array<Record<string, unknown>>;
    linkedConcepts: Array<Record<string, unknown>>;
  }> => {
    const includeBookChunks = args.includeBookChunks ?? true;
    const includeConcepts = args.includeConcepts ?? true;
    const limit = args.limit ?? 5;

    const results: {
      bookChunks: Array<Record<string, unknown>>;
      concepts: Array<Record<string, unknown>>;
      linkedConcepts: Array<Record<string, unknown>>;
    } = {
      bookChunks: [],
      concepts: [],
      linkedConcepts: [],
    };

    if (includeBookChunks) {
      const chunks = await ctx.vectorSearch("bookChunks", "by_embedding", {
        vector: args.embedding,
        limit,
      });

      for (const chunk of chunks) {
        const fullChunk: Record<string, unknown> | null = await ctx.runQuery(
          internal.knowledge.getBookChunkById,
          { chunkId: chunk._id }
        );
        if (fullChunk) {
          results.bookChunks.push({ ...fullChunk, score: chunk._score });
        }
      }
    }

    if (includeConcepts) {
      const conceptResults = await ctx.vectorSearch("concepts", "by_embedding", {
        vector: args.embedding,
        limit,
      });

      for (const conceptResult of conceptResults) {
        const fullConcept: Record<string, unknown> | null = await ctx.runQuery(
          internal.knowledge.getConceptById,
          { conceptId: conceptResult._id }
        );
        if (fullConcept) {
          results.concepts.push({ ...fullConcept, score: conceptResult._score });

          // Get linked concepts for multi-hop
          const linked: Array<Record<string, unknown>> = await ctx.runQuery(
            internal.knowledge.getLinkedConceptsInternal,
            { conceptId: conceptResult._id }
          );
          results.linkedConcepts.push(...linked);
        }
      }
    }

    return results;
  },
});

export const getLinkedConceptsInternal = internalQuery({
  args: { conceptId: v.id("concepts") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("conceptLinks")
      .withIndex("by_from", (q) => q.eq("fromConceptId", args.conceptId))
      .collect();

    const linkedConcepts = [];
    for (const link of links) {
      const concept = await ctx.db.get(link.toConceptId);
      if (concept) {
        linkedConcepts.push({
          concept,
          relationship: link.relationship,
        });
      }
    }

    return linkedConcepts;
  },
});
