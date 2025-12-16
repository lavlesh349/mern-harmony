import { cn } from "@/lib/utils";
import { Brain, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-4 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-accent/20 text-accent"
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
      </div>
      <div
        className={cn(
          "flex-1 max-w-[80%] rounded-2xl px-5 py-4",
          isUser
            ? "bg-primary/10 border border-primary/20"
            : "bg-card border border-border"
        )}
      >
        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-5 ml-1 bg-primary animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
}
