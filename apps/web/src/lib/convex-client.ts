/**
 * Server-side Convex client for API routes
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

export const convex = new ConvexHttpClient(CONVEX_URL);
