import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { systemPrompt, kintsuTools } from "../../lib/agents/kintsu";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages }: { messages: UIMessage[] } = await request.json();

        const result = streamText({
          model: openrouter.chat("moonshotai/kimi-k2.5"),
          system: systemPrompt,
          messages: await convertToModelMessages(messages),
          tools: kintsuTools,
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
