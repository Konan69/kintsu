/**
 * Book Ingestion Script for Kintsu
 *
 * Reads attached_content.txt, chunks it, generates embeddings,
 * and stores in Convex bookChunks table.
 *
 * Run with: bun run scripts/ingest-book.ts
 */

import { ConvexHttpClient } from "convex/browser";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";
import "dotenv/config";

// Import the API from the backend package
const api = await import("../packages/backend/convex/_generated/api").then(m => m.api);

const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!CONVEX_URL) {
  console.error("Missing CONVEX_URL environment variable");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY environment variable");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Chunk configuration
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // overlap between chunks
const BATCH_SIZE = 10; // chunks per batch for embedding

interface Chunk {
  content: string;
  sourceSection?: string;
  pageRef?: string;
}

/**
 * Split text into chunks with overlap
 */
function chunkText(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = text.split("\n");

  let currentChunk = "";
  let currentSection = "";
  let currentPage = "";

  for (const line of lines) {
    // Detect chapter/section headers
    if (line.match(/^(Chapter \d+|PART \w+|INTRODUCTION)/i)) {
      currentSection = line.trim();
    }

    // Detect page references (if any markers exist)
    const pageMatch = line.match(/\[Page (\d+)\]/);
    if (pageMatch) {
      currentPage = pageMatch[1];
    }

    currentChunk += line + "\n";

    // When chunk is large enough, save it
    if (currentChunk.length >= CHUNK_SIZE) {
      chunks.push({
        content: currentChunk.trim(),
        sourceSection: currentSection || undefined,
        pageRef: currentPage || undefined,
      });

      // Keep overlap for context continuity
      const words = currentChunk.split(" ");
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(" ");
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 100) {
    chunks.push({
      content: currentChunk.trim(),
      sourceSection: currentSection || undefined,
      pageRef: currentPage || undefined,
    });
  }

  return chunks;
}

/**
 * Generate embeddings for a batch of texts
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
    dimensions: 1536,
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Main ingestion function
 */
async function ingestBook() {
  console.log("Starting book ingestion...\n");

  // Read the book content
  const bookPath = resolve(import.meta.dir, "../books/attached_content.txt");
  console.log(`Reading from: ${bookPath}`);

  const content = readFileSync(bookPath, "utf-8");
  console.log(`Book content: ${content.length} characters\n`);

  // Chunk the content
  console.log("Chunking content...");
  const chunks = chunkText(content);
  console.log(`Created ${chunks.length} chunks\n`);

  // Process in batches
  let processed = 0;
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Processing batch ${batchNum}/${totalBatches}...`);

    // Generate embeddings for batch
    const texts = batch.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    // Prepare chunks with embeddings
    const chunksWithEmbeddings = batch.map((chunk, idx) => ({
      content: chunk.content,
      embedding: embeddings[idx],
      sourceSection: chunk.sourceSection,
      pageRef: chunk.pageRef,
    }));

    // Store in Convex
    await convex.mutation(api.knowledge.addBookChunksBatch, {
      chunks: chunksWithEmbeddings,
    });

    processed += batch.length;
    console.log(
      `  Stored ${processed}/${chunks.length} chunks (${Math.round((processed / chunks.length) * 100)}%)`
    );

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\nBook ingestion complete!");
  console.log(`Total chunks stored: ${chunks.length}`);
}

// Run the ingestion
ingestBook().catch(console.error);
