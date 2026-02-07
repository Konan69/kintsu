import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    attachmentStyle: v.union(v.literal("anxious"), v.literal("avoidant")),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      attachmentStyle: args.attachmentStyle,
      createdAt: Date.now(),
    });

    // Initialize core memory blocks
    const labels = [
      "user_profile",
      "partner_info",
      "relationship_context",
      "preferences",
    ] as const;

    for (const label of labels) {
      await ctx.db.insert("coreMemoryBlocks", {
        userId,
        label,
        content: "",
        updatedAt: Date.now(),
      });
    }

    return userId;
  },
});

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getWithCoreMemory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const coreMemory = await ctx.db
      .query("coreMemoryBlocks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      ...user,
      coreMemory: coreMemory.reduce(
        (acc, block) => {
          acc[block.label] = block.content;
          return acc;
        },
        {} as Record<string, string>
      ),
    };
  },
});

export const updateCoreMemory = mutation({
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
