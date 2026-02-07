import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SpeechInput } from "@/components/ai-elements/speech-input";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleTranscription = useCallback(
    (text: string) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    },
    []
  );

  const handleAudioRecorded = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Transcription failed");
    }

    const data = await res.json();
    return data.text || "";
  }, []);

  return (
    <div className="relative z-10 border-t border-border/40 bg-gradient-to-t from-background via-background to-background/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="p-4 pb-6">
        <div className="mx-auto max-w-2xl">
          {/* Input container */}
          <div className="relative flex items-end gap-3 rounded-2xl border border-border/60 bg-card/80 p-2 shadow-sm transition-all focus-within:border-gold/40 focus-within:shadow-md focus-within:shadow-gold/5">
            {/* Decorative gold accent */}
            <div className="absolute -left-px bottom-4 top-4 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100" />

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              disabled={isLoading || disabled}
              className="min-h-[48px] max-h-[200px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-[15px] placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />

            <div className="flex shrink-0 items-center gap-1.5">
              <SpeechInput
                onTranscriptionChange={handleTranscription}
                onAudioRecorded={handleAudioRecorded}
                size="icon"
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
              />

              <Button
                type="submit"
                disabled={!input.trim() || isLoading || disabled}
                className="group h-10 shrink-0 rounded-xl bg-primary px-4 text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-40"
              >
                {isLoading ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="animate-spin"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="32"
                      strokeDashoffset="12"
                    />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    <path
                      d="M2 8h12M10 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Button>
            </div>
          </div>

          {/* Helper text */}
          <p className="mt-3 text-center text-xs text-muted-foreground/60">
            Kintsu is here to help you understand yourself, not to replace
            professional therapy.
          </p>
        </div>
      </form>
    </div>
  );
}
