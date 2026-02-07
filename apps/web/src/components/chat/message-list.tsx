import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="mx-auto max-w-2xl space-y-8 p-6 pb-8">
        {messages.length === 0 && <EmptyState />}

        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLatest={index === messages.length - 1}
          />
        ))}

        {isLoading && <TypingIndicator />}
      </div>
    </ScrollArea>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      {/* Kintsugi bowl illustration */}
      <div className="mb-8">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          className="animate-float"
        >
          {/* Bowl shadow */}
          <ellipse
            cx="40"
            cy="65"
            rx="25"
            ry="5"
            fill="var(--foreground)"
            opacity="0.05"
          />

          {/* Bowl shape */}
          <path
            d="M12 30C12 30 17 60 40 60C63 60 68 30 68 30"
            stroke="var(--terracotta)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Bowl rim */}
          <ellipse
            cx="40"
            cy="30"
            rx="28"
            ry="8"
            stroke="var(--terracotta)"
            strokeWidth="2.5"
            fill="var(--cream)"
          />

          {/* Golden cracks */}
          <path
            d="M28 30L35 48"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M40 22L40 55"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M52 30L45 48"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Gold dots at junctions */}
          <circle cx="35" cy="48" r="2" fill="var(--gold)" />
          <circle cx="40" cy="55" r="2" fill="var(--gold)" />
          <circle cx="45" cy="48" r="2" fill="var(--gold)" />
        </svg>
      </div>

      <h2 className="font-serif text-3xl font-light text-foreground">
        Welcome to your space
      </h2>

      <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
        I'm here to help you understand your attachment patterns and communicate
        better with your partner. What's on your mind?
      </p>

      {/* Conversation starters */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {[
          "I had a conflict with my partner",
          "I'm feeling anxious about our relationship",
          "Help me understand my patterns",
        ].map((prompt) => (
          <button
            key={prompt}
            className="group rounded-full border border-border/60 bg-card/80 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-gold/40 hover:bg-card hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-1 w-1 rounded-full bg-gold opacity-0 transition-opacity group-hover:opacity-100"
              />
              {prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isLatest,
}: {
  message: UIMessage;
  isLatest: boolean;
}) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");

  return (
    <div
      className={cn(
        "flex gap-4",
        isUser && "flex-row-reverse",
        isLatest && "animate-fade-up"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          isUser
            ? "bg-muted"
            : "bg-gradient-to-br from-terracotta/20 to-gold/20"
        )}
      >
        {isUser ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            className="text-muted-foreground"
          >
            <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            {/* Simplified kintsugi bowl */}
            <path
              d="M3 7c0 0 1.5 7 6 7s6-7 6-7"
              stroke="var(--terracotta)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <ellipse
              cx="9"
              cy="7"
              rx="6"
              ry="2"
              stroke="var(--terracotta)"
              strokeWidth="1.5"
            />
            <path
              d="M7 7l1 4M9 5v7M11 7l-1 4"
              stroke="var(--gold)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Message content */}
      <div className={cn("flex max-w-[75%] flex-col gap-1", isUser && "items-end")}>
        <span className="text-xs font-medium text-muted-foreground">
          {isUser ? "You" : "Kintsu"}
        </span>

        <div
          className={cn(
            "rounded-2xl px-5 py-3 text-[15px] leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border/40 bg-card/80 text-foreground backdrop-blur-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{textContent}</p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-4 animate-fade-up">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-terracotta/20 to-gold/20">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M3 7c0 0 1.5 7 6 7s6-7 6-7"
            stroke="var(--terracotta)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <ellipse
            cx="9"
            cy="7"
            rx="6"
            ry="2"
            stroke="var(--terracotta)"
            strokeWidth="1.5"
          />
          <path
            d="M7 7l1 4M9 5v7M11 7l-1 4"
            stroke="var(--gold)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Typing dots */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Kintsu</span>
        <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border/40 bg-card/80 px-5 py-3 backdrop-blur-sm">
          <span
            className="h-2 w-2 rounded-full bg-terracotta/60"
            style={{ animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "0s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-gold/60"
            style={{ animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "0.16s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-sage/60"
            style={{ animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "0.32s" }}
          />
        </div>
      </div>
    </div>
  );
}
