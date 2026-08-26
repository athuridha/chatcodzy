"use client";

import { Terminal, BookOpen, Lightbulb, Compass } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

interface EmptyStateProps {
  displayName: string;
  onSuggestion?: (text: string) => void;
}

const PROMPT_SUGGESTIONS = [
  {
    icon: Lightbulb,
    title: "Explain quantum computing",
    desc: "In simple, intuitive terms with real-world analogies",
    prompt: "Can you explain quantum computing in simple terms?",
  },
  {
    icon: Terminal,
    title: "Python script help",
    desc: "Write clean and efficient automation code",
    prompt: "Help me write a Python script to automate data parsing.",
  },
  {
    icon: Compass,
    title: "Marketing strategy",
    desc: "Create an actionable growth plan for a product launch",
    prompt: "Create a marketing strategy for a new developer SaaS product.",
  },
  {
    icon: BookOpen,
    title: "Healthy meal plan",
    desc: "Structured weekly nutrition guide and recipes",
    prompt: "Give me a balanced 7-day healthy meal plan.",
  },
];

export function EmptyState({
  displayName,
  onSuggestion,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center max-w-2xl mx-auto">
      {/* Header Title */}
      <div className="flex flex-col items-center gap-3">
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
            {displayName ? `Hello, ${displayName}` : "How can I help you today?"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Ask any question, brainstorm ideas, or generate code. {APP_NAME} remembers your previous context.
          </p>
        </div>
      </div>

      {/* Suggestion Grid */}
      {onSuggestion && (
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
          {PROMPT_SUGGESTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                onClick={() => onSuggestion(item.prompt)}
                className="group flex flex-col gap-1 rounded-2xl border border-border/80 bg-card/60 p-4 transition-all hover:bg-accent hover:border-foreground/30 active:scale-[0.99] text-left shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground group-hover:underline-offset-2">
                    {item.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1 pl-8">
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
