import { createFileRoute } from "@tanstack/react-router";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;

        if (!audioFile) {
          return new Response(JSON.stringify({ error: "No audio file" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language: "en",
        });

        return new Response(JSON.stringify({ text: transcription.text }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
