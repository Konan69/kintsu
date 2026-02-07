import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";

const chatTransport = new DefaultChatTransport({
  api: "/api/chat",
});

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    transport: chatTransport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = (text: string) => {
    sendMessage({ text });
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-60 top-0 h-[600px] w-[600px] rounded-full opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle, var(--gold-light) 0%, transparent 60%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -left-40 bottom-20 h-[400px] w-[400px] rounded-full opacity-[0.06]"
          style={{
            background:
              "radial-gradient(circle, var(--sage-light) 0%, transparent 60%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
