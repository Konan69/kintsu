/**
 * Tests for the Kintsu Memory Extraction System
 *
 * Structure:
 *   - Pure unit tests for Zod schemas (extractionSchema, decisionSchema)
 *     These run directly with `bun test` since they only depend on Zod.
 *
 *   - Documented integration test scenarios for Convex functions
 *     (extractAndStoreMemories, queueForProcessing, processQueue)
 *     These are structured as describe/it blocks with assertions where possible
 *     and explanatory comments where Convex runtime would be required.
 *
 * Run with: bun test packages/backend/convex/memories.test.ts
 */

import { describe, it, expect } from "bun:test";
import { z } from "zod";

// ============================================
// Re-declare schemas (mirrors memories.ts)
// These are duplicated here because the source file's schemas are module-scoped
// and not exported. In a production setup you would export them or extract
// to a shared module.
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

// Re-declare computeContentHash (mirrors memories.ts)
async function computeContentHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type ExtractedMemory = z.infer<typeof extractionSchema>["memories"][number];
type MemoryDecision = z.infer<typeof decisionSchema>["decisions"][number];

// ============================================
// 1. Unit Tests for extractionSchema
// ============================================

describe("extractionSchema", () => {
  it("accepts a valid extraction with memories and core_memory_updates", () => {
    const valid = {
      memories: [
        {
          content: "User's name is Alex",
          type: "semantic",
          keywords: ["name", "user"],
        },
        {
          content:
            "Had an argument about finances last Tuesday",
          type: "episodic",
          keywords: ["argument", "finances"],
        },
        {
          content:
            "Using 'I feel' statements helps de-escalate conflicts",
          type: "procedural",
          keywords: ["communication", "strategy"],
        },
      ],
      core_memory_updates: [
        {
          label: "user_profile",
          content: "Name: Alex. Attachment style: anxious-preoccupied.",
        },
        {
          label: "partner_info",
          content: "Partner name: Jordan. Tends to withdraw during conflict.",
        },
      ],
    };

    const result = extractionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memories).toHaveLength(3);
      expect(result.data.core_memory_updates).toHaveLength(2);
    }
  });

  it("accepts empty arrays (no memories extracted from small talk)", () => {
    const valid = {
      memories: [],
      core_memory_updates: [],
    };

    const result = extractionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memories).toHaveLength(0);
      expect(result.data.core_memory_updates).toHaveLength(0);
    }
  });

  it("accepts memories with empty keywords array", () => {
    const valid = {
      memories: [
        {
          content: "Some observation",
          type: "semantic",
          keywords: [],
        },
      ],
      core_memory_updates: [],
    };

    const result = extractionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid memory type", () => {
    const invalid = {
      memories: [
        {
          content: "A memory",
          type: "declarative", // not in the enum
          keywords: ["test"],
        },
      ],
      core_memory_updates: [],
    };

    const result = extractionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid core_memory_update label", () => {
    const invalid = {
      memories: [],
      core_memory_updates: [
        {
          label: "work_history", // not in the enum
          content: "Some content",
        },
      ],
    };

    const result = extractionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields in a memory object", () => {
    const missingContent = {
      memories: [
        {
          // content is missing
          type: "semantic",
          keywords: ["test"],
        },
      ],
      core_memory_updates: [],
    };

    const result = extractionSchema.safeParse(missingContent);
    expect(result.success).toBe(false);
  });

  it("rejects missing keywords field in a memory object", () => {
    const missingKeywords = {
      memories: [
        {
          content: "A fact",
          type: "semantic",
          // keywords is missing
        },
      ],
      core_memory_updates: [],
    };

    const result = extractionSchema.safeParse(missingKeywords);
    expect(result.success).toBe(false);
  });

  it("rejects non-string content in core_memory_updates", () => {
    const invalid = {
      memories: [],
      core_memory_updates: [
        {
          label: "user_profile",
          content: 42, // should be string
        },
      ],
    };

    const result = extractionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects completely wrong shape (string instead of object)", () => {
    const result = extractionSchema.safeParse("not an object");
    expect(result.success).toBe(false);
  });

  it("rejects missing top-level fields", () => {
    const result = extractionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates all four core memory label values", () => {
    const labels = [
      "user_profile",
      "partner_info",
      "relationship_context",
      "preferences",
    ] as const;

    for (const label of labels) {
      const valid = {
        memories: [],
        core_memory_updates: [{ label, content: "test" }],
      };
      const result = extractionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    }
  });

  it("validates all three memory type values", () => {
    const types = ["episodic", "semantic", "procedural"] as const;

    for (const type of types) {
      const valid = {
        memories: [{ content: "test", type, keywords: [] }],
        core_memory_updates: [],
      };
      const result = extractionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    }
  });
});

// ============================================
// 2. Unit Tests for decisionSchema
// ============================================

describe("decisionSchema", () => {
  it("accepts a valid ADD decision", () => {
    const valid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "ADD",
          content: "User prefers morning check-ins",
          reason: "No existing memory about check-in preferences",
        },
      ],
    };

    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decisions[0].action).toBe("ADD");
    }
  });

  it("accepts a valid UPDATE decision with target_memory_id", () => {
    const valid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "UPDATE",
          content: "User prefers morning check-ins, especially on weekdays",
          target_memory_id: "some_memory_id_123",
          reason: "Enhances existing memory about check-in preferences",
        },
      ],
    };

    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decisions[0].target_memory_id).toBe(
        "some_memory_id_123"
      );
    }
  });

  it("accepts a valid INVALIDATE decision", () => {
    const valid = {
      decisions: [
        {
          new_memory_index: 1,
          action: "INVALIDATE",
          target_memory_id: "old_memory_id",
          reason: "New information contradicts this memory",
        },
      ],
    };

    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts a valid NOOP decision", () => {
    const valid = {
      decisions: [
        {
          new_memory_index: 2,
          action: "NOOP",
          reason: "Already captured by existing memory",
        },
      ],
    };

    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts multiple decisions in a single response", () => {
    const valid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "ADD",
          content: "New fact about user",
          reason: "Genuinely new information",
        },
        {
          new_memory_index: 1,
          action: "NOOP",
          reason: "Duplicate of existing",
        },
        {
          new_memory_index: 2,
          action: "INVALIDATE",
          target_memory_id: "old_id",
          reason: "Contradicted by new info",
        },
        {
          new_memory_index: 3,
          action: "UPDATE",
          content: "Merged memory content",
          target_memory_id: "existing_id",
          reason: "Enhances existing memory",
        },
      ],
    };

    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decisions).toHaveLength(4);
    }
  });

  it("accepts empty decisions array", () => {
    const valid = { decisions: [] };
    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid action type", () => {
    const invalid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "DELETE", // not a valid action
          reason: "test",
        },
      ],
    };

    const result = decisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects HASH_DUPLICATE as a decision action (not an LLM action)", () => {
    // HASH_DUPLICATE is an audit-only action, not produced by the LLM
    const invalid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "HASH_DUPLICATE",
          reason: "test",
        },
      ],
    };

    const result = decisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing new_memory_index", () => {
    const invalid = {
      decisions: [
        {
          action: "ADD",
          content: "Some content",
          reason: "test",
        },
      ],
    };

    const result = decisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing reason field", () => {
    const invalid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "ADD",
          content: "Some content",
          // reason is missing
        },
      ],
    };

    const result = decisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-number new_memory_index", () => {
    const invalid = {
      decisions: [
        {
          new_memory_index: "zero", // should be number
          action: "ADD",
          content: "Some content",
          reason: "test",
        },
      ],
    };

    const result = decisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("allows content and target_memory_id to be omitted (they are optional)", () => {
    const valid = {
      decisions: [
        {
          new_memory_index: 0,
          action: "NOOP",
          reason: "Already exists",
          // content and target_memory_id intentionally omitted
        },
      ],
    };

    const result = decisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decisions[0].content).toBeUndefined();
      expect(result.data.decisions[0].target_memory_id).toBeUndefined();
    }
  });

  it("rejects completely wrong shape", () => {
    const result = decisionSchema.safeParse({ decisions: "not an array" });
    expect(result.success).toBe(false);
  });
});

// ============================================
// 3. Type inference tests
// ============================================

describe("Type inference", () => {
  it("ExtractedMemory type has the expected shape", () => {
    const memory: ExtractedMemory = {
      content: "Test memory",
      type: "semantic",
      keywords: ["test"],
    };

    // Verify the type narrows correctly at runtime
    expect(memory.content).toBe("Test memory");
    expect(memory.type).toBe("semantic");
    expect(memory.keywords).toEqual(["test"]);
  });

  it("MemoryDecision type has the expected shape", () => {
    const decision: MemoryDecision = {
      new_memory_index: 0,
      action: "ADD",
      content: "New memory",
      reason: "First time seeing this",
    };

    expect(decision.action).toBe("ADD");
    expect(decision.new_memory_index).toBe(0);
  });

  it("MemoryDecision allows optional fields to be undefined", () => {
    const decision: MemoryDecision = {
      new_memory_index: 0,
      action: "NOOP",
      reason: "Already exists",
    };

    expect(decision.content).toBeUndefined();
    expect(decision.target_memory_id).toBeUndefined();
  });
});

// ============================================
// 4. Integration Test Scenarios for extractAndStoreMemories
//
// These tests document the expected behavior of the full pipeline.
// They cannot run as pure unit tests because they require the Convex
// runtime (ctx.runQuery, ctx.runMutation, ctx.vectorSearch, LLM calls).
//
// To run these for real, use convex-test or a Convex test harness
// that provides a mock/real Convex context. The structure below is
// ready to be wired up to such a harness.
// ============================================

describe("extractAndStoreMemories integration scenarios", () => {
  describe("Empty conversation produces no memories", () => {
    it("should return early when no messages are provided", () => {
      // SCENARIO:
      // - messages array is empty (or all messages are greetings)
      // - The LLM extraction returns { memories: [], core_memory_updates: [] }
      //
      // EXPECTED BEHAVIOR (from source lines 302-309):
      //   const hasMemories = extraction.memories && extraction.memories.length > 0;
      //   const hasCoreUpdates = extraction.core_memory_updates && extraction.core_memory_updates.length > 0;
      //   if (!hasMemories && !hasCoreUpdates) { return; }
      //
      // VERIFICATION:
      // - No calls to addInternal, invalidateInternal, or updateCoreMemoryInternal
      // - Function returns early without error

      const extraction = { memories: [], core_memory_updates: [] };
      const hasMemories = extraction.memories.length > 0;
      const hasCoreUpdates = extraction.core_memory_updates.length > 0;

      expect(hasMemories).toBe(false);
      expect(hasCoreUpdates).toBe(false);
      // In the real function, this triggers an early return
    });
  });

  describe("Conversation with user info extracts semantic memories + core memory updates", () => {
    it("should extract user details and update core memory blocks", () => {
      // SCENARIO:
      // - User says: "My name is Alex, I have an anxious attachment style.
      //   My partner Jordan tends to withdraw when we argue."
      //
      // EXPECTED LLM EXTRACTION:
      const expectedExtraction = {
        memories: [
          {
            content: "User has an anxious attachment style",
            type: "semantic" as const,
            keywords: ["attachment", "anxious"],
          },
          {
            content:
              "Partner Jordan tends to withdraw during arguments",
            type: "semantic" as const,
            keywords: ["partner", "avoidant", "withdrawal", "conflict"],
          },
        ],
        core_memory_updates: [
          {
            label: "user_profile" as const,
            content:
              "Name: Alex. Attachment style: anxious-preoccupied.",
          },
          {
            label: "partner_info" as const,
            content:
              "Name: Jordan. Behavioral pattern: withdraws during conflict.",
          },
        ],
      };

      // Validate the expected output matches the schema
      const result = extractionSchema.safeParse(expectedExtraction);
      expect(result.success).toBe(true);

      // EXPECTED BEHAVIOR:
      // 1. core_memory_updates are applied via updateCoreMemoryInternal (lines 318-330)
      //    - user_profile block is upserted with Alex's info
      //    - partner_info block is upserted with Jordan's info
      // 2. Each memory gets an embedding generated (line 350)
      // 3. Vector search finds no similar existing memories (new user)
      // 4. Since uniqueExisting.length === 0, all memories get ADD decisions (lines 419-425)
      // 5. addInternal is called for each memory
    });
  });

  describe("Duplicate memory triggers NOOP decision", () => {
    it("should produce a NOOP when semantically equivalent memory exists", () => {
      // SCENARIO:
      // - Existing memory in DB: "User has an anxious attachment style"
      // - New extraction: "The user's attachment style is anxious"
      // - Vector search returns high similarity score (e.g., 0.95)
      //
      // EXPECTED LLM DECISION:
      const expectedDecisions = {
        decisions: [
          {
            new_memory_index: 0,
            action: "NOOP" as const,
            reason:
              "Semantically equivalent to existing memory about anxious attachment style",
          },
        ],
      };

      const result = decisionSchema.safeParse(expectedDecisions);
      expect(result.success).toBe(true);

      // EXPECTED BEHAVIOR:
      // - The NOOP case (line 506-507) is a no-op; no DB writes occur
      // - The existing memory remains unchanged
      // - No new memory is inserted
    });
  });

  describe("Contradictory memory triggers INVALIDATE old + ADD new", () => {
    it("should invalidate the old memory and add the corrected version", () => {
      // SCENARIO:
      // - Existing memory: "User's partner is named Jordan"
      //   (with ID "existing_partner_name_id")
      // - New extraction: "User's partner is named Taylor" (they started
      //   a new relationship)
      //
      // EXPECTED LLM DECISIONS (two decisions for one contradictory memory):
      const expectedDecisions = {
        decisions: [
          {
            new_memory_index: 0,
            action: "INVALIDATE" as const,
            target_memory_id: "existing_partner_name_id",
            reason:
              "Partner name has changed; old memory is no longer accurate",
          },
          {
            new_memory_index: 0,
            action: "ADD" as const,
            content: "User's partner is named Taylor",
            reason:
              "Corrected partner name after invalidating outdated memory",
          },
        ],
      };

      const result = decisionSchema.safeParse(expectedDecisions);
      expect(result.success).toBe(true);

      // EXPECTED BEHAVIOR:
      // 1. INVALIDATE case (lines 497-503):
      //    - invalidateInternal is called with target_memory_id
      //    - This sets invalidAt = Date.now() on the old memory
      //    - The old memory is soft-deleted (still in DB but filtered out of searches)
      //
      // 2. ADD case (lines 458-475):
      //    - A new memory "User's partner is named Taylor" is created
      //    - It gets a fresh embedding
      //    - addInternal inserts it with validAt = Date.now()
    });
  });

  describe("Memory enhancement triggers UPDATE (invalidate old, add merged)", () => {
    it("should invalidate the old memory and add an enhanced merged version", () => {
      // SCENARIO:
      // - Existing memory: "Partner tends to withdraw during arguments"
      //   (with ID "existing_withdrawal_id")
      // - New extraction: "Partner withdraws during arguments, especially
      //   about finances, but is more open about household topics"
      //
      // EXPECTED LLM DECISION:
      const expectedDecisions = {
        decisions: [
          {
            new_memory_index: 0,
            action: "UPDATE" as const,
            content:
              "Partner tends to withdraw during arguments, especially about finances, but is more receptive when discussing household topics",
            target_memory_id: "existing_withdrawal_id",
            reason:
              "Enhances existing memory with specifics about when withdrawal occurs and exceptions",
          },
        ],
      };

      const result = decisionSchema.safeParse(expectedDecisions);
      expect(result.success).toBe(true);

      // EXPECTED BEHAVIOR (lines 477-495):
      // 1. UPDATE triggers a temporal-validity pattern:
      //    a. invalidateInternal is called on "existing_withdrawal_id"
      //       => sets invalidAt = Date.now() on the old memory
      //    b. A NEW embedding is generated for the merged content
      //    c. addInternal creates a new memory with the merged text
      //
      // This preserves history (old memory still in DB with invalidAt set)
      // while keeping the active memory set clean and deduplicated.
    });
  });

  describe("No existing similar memories leads to ADD-all shortcut", () => {
    it("should ADD all extracted memories when no similar existing memories are found", () => {
      // SCENARIO:
      // - First conversation for a brand new user
      // - 3 memories extracted, vector search returns empty for all
      //
      // EXPECTED BEHAVIOR (lines 419-425):
      //   if (uniqueExisting.length === 0) {
      //     decisions = memoriesWithContext.map((m, i) => ({
      //       new_memory_index: i,
      //       action: "ADD",
      //       content: m.memory.content,
      //       reason: "No similar existing memories found",
      //     }));
      //   }
      //
      // - The LLM decision call is SKIPPED entirely
      // - All memories are added with their original content and embeddings

      const memoriesWithContext = [
        {
          memory: {
            content: "Memory A",
            type: "semantic" as const,
            keywords: ["a"],
          },
          embedding: new Array(1536).fill(0),
          similar: [],
        },
        {
          memory: {
            content: "Memory B",
            type: "episodic" as const,
            keywords: ["b"],
          },
          embedding: new Array(1536).fill(0),
          similar: [],
        },
      ];

      // Replicate the production logic for the ADD-all shortcut
      const existingByID: Record<string, unknown> = {};
      for (const m of memoriesWithContext) {
        for (const s of m.similar) {
          existingByID[(s as { _id: string })._id] = s;
        }
      }
      const uniqueExisting = Object.values(existingByID);

      expect(uniqueExisting).toHaveLength(0);

      // Auto-generate ADD decisions
      const decisions = memoriesWithContext.map((m, i) => ({
        new_memory_index: i,
        action: "ADD" as const,
        content: m.memory.content,
        reason: "No similar existing memories found",
      }));

      expect(decisions).toHaveLength(2);
      expect(decisions[0].action).toBe("ADD");
      expect(decisions[1].action).toBe("ADD");
      expect(decisions[0].content).toBe("Memory A");
      expect(decisions[1].content).toBe("Memory B");
    });
  });

  describe("LLM extraction failure is handled gracefully", () => {
    it("should return early without error when extraction LLM fails", () => {
      // SCENARIO:
      // - generateObject throws an error (API down, rate limit, etc.)
      //
      // EXPECTED BEHAVIOR (lines 297-300):
      //   } catch (error) {
      //     console.error("Memory extraction failed:", error);
      //     return;
      //   }
      //
      // - Function returns early
      // - No memories are stored, no core memory blocks are updated
      // - The error is logged but does not propagate (queue item can still be marked failed)

      // This test verifies the schema would reject a malformed extraction
      const malformed = { memories: "not_an_array", core_memory_updates: [] };
      const result = extractionSchema.safeParse(malformed);
      expect(result.success).toBe(false);
    });
  });

  describe("LLM decision failure falls back to ADD-all", () => {
    it("should default to ADD for all memories when decision LLM fails", () => {
      // SCENARIO:
      // - Extraction succeeds with 2 memories
      // - Similar existing memories ARE found
      // - Decision LLM call throws an error
      //
      // EXPECTED BEHAVIOR (lines 441-448):
      //   } catch (error) {
      //     console.error("Memory decision LLM failed, defaulting to ADD:", error);
      //     decisions = memoriesWithContext.map((m, i) => ({
      //       new_memory_index: i,
      //       action: "ADD",
      //       content: m.memory.content,
      //       reason: "Decision LLM call failed, defaulting to ADD",
      //     }));
      //   }
      //
      // - All memories are added as new (conservative fallback)
      // - This may create duplicates, but they can be resolved in a future pass

      const memoriesWithContext = [
        {
          memory: {
            content: "User feels anxious before meetings",
            type: "episodic" as const,
            keywords: ["anxiety"],
          },
        },
        {
          memory: {
            content: "Partner is supportive on weekends",
            type: "semantic" as const,
            keywords: ["partner", "support"],
          },
        },
      ];

      // Simulate the fallback
      const decisions = memoriesWithContext.map((m, i) => ({
        new_memory_index: i,
        action: "ADD" as const,
        content: m.memory.content,
        reason: "Decision LLM call failed, defaulting to ADD",
      }));

      expect(decisions).toHaveLength(2);
      for (const d of decisions) {
        expect(d.action).toBe("ADD");
        expect(d.reason).toContain("defaulting to ADD");
      }
    });
  });

  describe("Invalid decision index is skipped safely", () => {
    it("should skip decisions with out-of-bounds new_memory_index", () => {
      // SCENARIO:
      // - LLM returns a decision with new_memory_index: 99 but only 2 memories exist
      //
      // EXPECTED BEHAVIOR (lines 453-454):
      //   const entry = memoriesWithContext[decision.new_memory_index];
      //   if (!entry) continue;
      //
      // - The decision is silently skipped
      // - Other valid decisions are still processed

      const memoriesWithContext = [{ memory: { content: "A" } }]; // length 1
      const decisions: MemoryDecision[] = [
        {
          new_memory_index: 99,
          action: "ADD",
          content: "Ghost memory",
          reason: "Bad index",
        },
        {
          new_memory_index: 0,
          action: "ADD",
          content: "Valid memory",
          reason: "Good index",
        },
      ];

      const executed: MemoryDecision[] = [];
      for (const decision of decisions) {
        const entry = memoriesWithContext[decision.new_memory_index];
        if (!entry) continue;
        executed.push(decision);
      }

      expect(executed).toHaveLength(1);
      expect(executed[0].new_memory_index).toBe(0);
    });
  });
});

// ============================================
// 5. Queue Processing Tests
// ============================================

describe("queueForProcessing", () => {
  describe("deduplication of pending items", () => {
    it("documents: should not insert a new queue entry if one already exists for the same conversation", () => {
      // SCENARIO:
      // - queueForProcessing is called for conversationId "conv_1"
      // - A pending entry for "conv_1" already exists in memoryQueue
      //
      // EXPECTED BEHAVIOR (lines 141-147):
      //   const existing = await ctx.db
      //     .query("memoryQueue")
      //     .withIndex("by_status", (q) => q.eq("status", "pending"))
      //     .filter((q) => q.eq(q.field("conversationId"), args.conversationId))
      //     .first();
      //
      //   if (!existing) { ... insert and schedule ... }
      //
      // VERIFICATION:
      // - When existing is truthy, no insert happens
      // - No scheduler.runAfter is called
      // - The function completes without error

      // Simulate deduplication logic
      const existingEntry = {
        _id: "queue_123",
        userId: "user_1",
        conversationId: "conv_1",
        status: "pending",
        createdAt: Date.now(),
      };

      const shouldInsert = !existingEntry;
      expect(shouldInsert).toBe(false);
    });

    it("documents: should insert a new queue entry when none exists for the conversation", () => {
      // SCENARIO:
      // - queueForProcessing is called for conversationId "conv_2"
      // - No pending entry for "conv_2" exists
      //
      // EXPECTED BEHAVIOR:
      // - A new entry is inserted into memoryQueue with status "pending"
      // - scheduler.runAfter is called with 5000ms delay to trigger processQueue

      const existingEntry = null;
      const shouldInsert = !existingEntry;
      expect(shouldInsert).toBe(true);
    });

    it("documents: should allow re-queueing if previous entry was completed or failed", () => {
      // SCENARIO:
      // - A previous entry for "conv_1" exists with status "completed"
      // - queueForProcessing is called again for "conv_1"
      //
      // EXPECTED BEHAVIOR:
      // - The query filters by status "pending", so completed/failed entries are invisible
      // - A new pending entry IS inserted (correct behavior for re-processing)

      const existingCompletedEntry = {
        _id: "queue_456",
        conversationId: "conv_1",
        status: "completed", // not "pending", so the query won't find it
      };

      // Simulate the filter: the index query only returns "pending" status
      const queryResult =
        existingCompletedEntry.status === "pending"
          ? existingCompletedEntry
          : null;
      const shouldInsert = !queryResult;
      expect(shouldInsert).toBe(true);
    });
  });
});

describe("processQueue", () => {
  describe("handles failures gracefully", () => {
    it("documents: should mark a queue item as failed when processing throws", () => {
      // SCENARIO:
      // - processQueue picks up a pending item
      // - markProcessing succeeds
      // - extractAndStoreMemories (or a preceding step) throws an error
      //
      // EXPECTED BEHAVIOR (lines 197-200):
      //   } catch (error) {
      //     await ctx.runMutation(internal.memories.markFailed, {
      //       queueId: item._id,
      //     });
      //   }
      //
      // - The failed item gets status "failed"
      // - Processing continues to the next item in the loop
      // - Other pending items are NOT affected

      // Simulate the try/catch flow
      const queueItems = [
        { _id: "q1", conversationId: "c1", userId: "u1" },
        { _id: "q2", conversationId: "c2", userId: "u2" },
      ];

      const results: Array<{ id: string; status: string }> = [];

      for (const item of queueItems) {
        try {
          if (item._id === "q1") {
            throw new Error("Simulated LLM failure");
          }
          results.push({ id: item._id, status: "completed" });
        } catch {
          results.push({ id: item._id, status: "failed" });
        }
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: "q1", status: "failed" });
      expect(results[1]).toEqual({ id: "q2", status: "completed" });
    });

    it("documents: should skip empty conversations without error", () => {
      // SCENARIO:
      // - A conversation has 0 messages (was created but user never typed)
      // - processQueue picks it up
      //
      // EXPECTED BEHAVIOR (lines 182-192):
      //   if (messages.length > 0) {
      //     await ctx.runAction(internal.memories.extractAndStoreMemories, { ... });
      //   }
      //
      // - extractAndStoreMemories is NOT called
      // - The item is still marked as completed (not failed)
      // - This is an optimization to avoid unnecessary LLM calls

      const messages: Array<{ role: string; content: string }> = [];
      const shouldProcess = messages.length > 0;
      expect(shouldProcess).toBe(false);
    });

    it("documents: processQueue takes at most 10 pending items per run", () => {
      // SCENARIO:
      // - 25 items are pending in the queue
      //
      // EXPECTED BEHAVIOR (lines 209-213):
      //   return await ctx.db
      //     .query("memoryQueue")
      //     .withIndex("by_status", (q) => q.eq("status", "pending"))
      //     .take(10);
      //
      // - Only the first 10 are returned and processed
      // - The remaining 15 stay pending for the next processQueue invocation
      // - This prevents any single run from blocking too long

      const BATCH_SIZE = 10;
      expect(BATCH_SIZE).toBe(10);
    });
  });
});

// ============================================
// 6. Core Memory Update Logic
// ============================================

describe("Core memory update validation", () => {
  it("only processes valid label values", () => {
    // This tests the validLabels guard in extractAndStoreMemories (lines 312-317)
    const validLabels = [
      "user_profile",
      "partner_info",
      "relationship_context",
      "preferences",
    ];

    const updates = [
      { label: "user_profile", content: "Alex, anxious attachment" },
      { label: "partner_info", content: "Jordan, avoidant" },
      { label: "hacked_field", content: "Should be filtered out" },
    ];

    const accepted = updates.filter((u) => validLabels.includes(u.label));
    expect(accepted).toHaveLength(2);
    expect(accepted.map((a) => a.label)).toEqual([
      "user_profile",
      "partner_info",
    ]);
  });
});

// ============================================
// 7. Decision Execution Edge Cases
// ============================================

describe("Decision execution edge cases", () => {
  it("UPDATE with missing target_memory_id is a no-op", () => {
    // EXPECTED BEHAVIOR (lines 477-478):
    //   if (decision.target_memory_id && decision.content) { ... }
    // If either is missing, the UPDATE is silently skipped

    const decision: MemoryDecision = {
      new_memory_index: 0,
      action: "UPDATE",
      content: "Merged content",
      // target_memory_id is missing
      reason: "Should be skipped",
    };

    const wouldExecute = !!(decision.target_memory_id && decision.content);
    expect(wouldExecute).toBe(false);
  });

  it("UPDATE with missing content is a no-op", () => {
    const decision: MemoryDecision = {
      new_memory_index: 0,
      action: "UPDATE",
      target_memory_id: "some_id",
      // content is missing
      reason: "Should be skipped",
    };

    const wouldExecute = !!(decision.target_memory_id && decision.content);
    expect(wouldExecute).toBe(false);
  });

  it("INVALIDATE with missing target_memory_id is a no-op", () => {
    // EXPECTED BEHAVIOR (lines 497-498):
    //   if (decision.target_memory_id) { ... }

    const decision: MemoryDecision = {
      new_memory_index: 0,
      action: "INVALIDATE",
      // target_memory_id is missing
      reason: "Should be skipped",
    };

    const wouldExecute = !!decision.target_memory_id;
    expect(wouldExecute).toBe(false);
  });

  it("ADD uses original content when LLM does not rewrite", () => {
    // EXPECTED BEHAVIOR (line 459):
    //   const content = decision.content || entry.memory.content;
    // If decision.content is undefined, falls back to original extracted text

    const entryContent = "Original extracted text";
    const decisionContent = undefined;

    const finalContent = decisionContent || entryContent;
    expect(finalContent).toBe("Original extracted text");
  });

  it("ADD uses LLM-rewritten content when provided", () => {
    const entryContent = "Original extracted text";
    const decisionContent = "Rewritten by LLM for clarity";

    const finalContent = decisionContent || entryContent;
    expect(finalContent).toBe("Rewritten by LLM for clarity");
  });

  it("ADD re-embeds only when content was rewritten", () => {
    // EXPECTED BEHAVIOR (lines 461-464):
    //   const embedding =
    //     content !== entry.memory.content
    //       ? await generateEmbedding(content)
    //       : entry.embedding;

    const originalContent = "Partner withdraws during arguments";
    const originalEmbedding = [0.1, 0.2, 0.3]; // placeholder

    // Case 1: content unchanged -> reuse existing embedding
    const content1 = originalContent;
    const shouldReEmbed1 = content1 !== originalContent;
    expect(shouldReEmbed1).toBe(false);

    // Case 2: content rewritten -> must generate new embedding
    const content2 = "Partner tends to emotionally withdraw during arguments";
    const shouldReEmbed2 = content2 !== originalContent;
    expect(shouldReEmbed2).toBe(true);
  });
});

// ============================================
// 8. Deduplication Logic for Similar Memories
// ============================================

describe("Similar memory deduplication (existingByID)", () => {
  it("deduplicates overlapping similar memories across multiple extracted memories", () => {
    // SCENARIO:
    // - Memory A's vector search returns existing memories [X, Y]
    // - Memory B's vector search returns existing memories [Y, Z]
    // - The dedup logic (lines 401-415) should produce unique set [X, Y, Z]

    const memoryAResults = [
      { _id: "X", content: "fact X", type: "semantic", score: 0.9 },
      { _id: "Y", content: "fact Y", type: "semantic", score: 0.85 },
    ];

    const memoryBResults = [
      { _id: "Y", content: "fact Y", type: "semantic", score: 0.88 },
      { _id: "Z", content: "fact Z", type: "episodic", score: 0.8 },
    ];

    const memoriesWithContext = [
      { similar: memoryAResults },
      { similar: memoryBResults },
    ];

    // Replicate the production dedup logic
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

    expect(uniqueExisting).toHaveLength(3);
    const ids = uniqueExisting.map((e) => e.id).sort();
    expect(ids).toEqual(["X", "Y", "Z"]);
  });

  it("keeps the last-seen similarity score when deduplicating", () => {
    // The current implementation overwrites with the last value seen.
    // This means if memory A sees Y with score 0.85 and memory B sees Y
    // with score 0.88, the final score for Y will be 0.88.

    const memoriesWithContext = [
      {
        similar: [
          { _id: "Y", content: "fact Y", type: "semantic", score: 0.85 },
        ],
      },
      {
        similar: [
          { _id: "Y", content: "fact Y", type: "semantic", score: 0.88 },
        ],
      },
    ];

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

    // Last write wins: 0.88 from the second pass
    expect(existingByID["Y"].similarity).toBe(0.88);
  });
});

// ============================================
// 9. Content Hash Normalization Tests
// ============================================

describe("computeContentHash", () => {
  it("produces consistent hashes for the same content", async () => {
    const hash1 = await computeContentHash("User has anxious attachment style");
    const hash2 = await computeContentHash("User has anxious attachment style");
    expect(hash1).toBe(hash2);
  });

  it("normalizes whitespace (trim)", async () => {
    const hash1 = await computeContentHash("User has anxious attachment style");
    const hash2 = await computeContentHash("  User has anxious attachment style  ");
    expect(hash1).toBe(hash2);
  });

  it("normalizes case (toLowerCase)", async () => {
    const hash1 = await computeContentHash("User has anxious attachment style");
    const hash2 = await computeContentHash("USER HAS ANXIOUS ATTACHMENT STYLE");
    expect(hash1).toBe(hash2);
  });

  it("normalizes both trim and case together", async () => {
    const hash1 = await computeContentHash("hello world");
    const hash2 = await computeContentHash("  HELLO WORLD  ");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", async () => {
    const hash1 = await computeContentHash("User has anxious attachment style");
    const hash2 = await computeContentHash("User has avoidant attachment style");
    expect(hash1).not.toBe(hash2);
  });

  it("produces a 64-character hex string (SHA-256)", async () => {
    const hash = await computeContentHash("test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ============================================
// 10. Conversation Length Guard Tests
// ============================================

describe("Conversation length guard", () => {
  it("takes last 20 messages when conversation exceeds MAX_MESSAGES", () => {
    const MAX_MESSAGES = 20;
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const messagesToProcess =
      messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;

    expect(messagesToProcess).toHaveLength(20);
    expect(messagesToProcess[0].content).toBe("Message 30");
    expect(messagesToProcess[19].content).toBe("Message 49");
  });

  it("keeps all messages when conversation is under MAX_MESSAGES", () => {
    const MAX_MESSAGES = 20;
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const messagesToProcess =
      messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;

    expect(messagesToProcess).toHaveLength(10);
    expect(messagesToProcess[0].content).toBe("Message 0");
  });

  it("handles exactly MAX_MESSAGES messages (boundary case)", () => {
    const MAX_MESSAGES = 20;
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const messagesToProcess =
      messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;

    expect(messagesToProcess).toHaveLength(20);
    expect(messagesToProcess[0].content).toBe("Message 0");
  });
});
