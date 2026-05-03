import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/morning")({
  component: MorningPage,
});

type Message = {
  role: "ai" | "user";
  content: string;
  timestamp: Date;
};

type SessionData = {
  energyLevel: number | null;
  focusBrands: string[];
  notes: string;
};

const FIRST_MESSAGE =
  "Good morning. Before we build your day, let me ask you a few things. How's your energy today — on a scale of 1 to 10?";

const TOTAL_STEPS = 3;

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1 h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
              style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MorningPage() {
  const { user } = useAuth();

  const firstName = (() => {
    const meta = user?.user_metadata;
    if (meta?.full_name) return (meta.full_name as string).split(" ")[0];
    if (meta?.name) return (meta.name as string).split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "there";
  })();

  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: FIRST_MESSAGE, timestamp: new Date() },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [_sessionData, setSessionData] = useState<SessionData>({
    energyLevel: null,
    focusBrands: [],
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isLoading || currentStep >= TOTAL_STEPS) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date() },
    ]);
    setInput("");

    if (currentStep === 0) {
      const energy = parseInt(text, 10);
      if (!isNaN(energy)) {
        setSessionData((prev) => ({ ...prev, energyLevel: energy }));
      }
    } else if (currentStep === 1) {
      setSessionData((prev) => ({
        ...prev,
        focusBrands: text.split(",").map((s) => s.trim()).filter(Boolean),
      }));
    } else if (currentStep === 2) {
      setSessionData((prev) => ({ ...prev, notes: text }));
    }

    setCurrentStep((s) => s + 1);
    setIsLoading(true);

    // Simulate AI thinking — no real API yet
    setTimeout(() => {
      setIsLoading(false);
    }, 1200);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <span className="font-semibold text-foreground">
          Good morning, {firstName}
        </span>
        <Link
          to="/dashboard"
          search={{ brand: undefined }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for today
        </Link>
      </header>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-5 shrink-0">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              i < currentStep
                ? "bg-primary"
                : i === currentStep
                ? "bg-primary/50"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Chat column */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto w-full max-w-[640px] px-4 flex flex-col">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={cn(
                "flex mb-4",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "ai"
                    ? "rounded-bl-sm bg-muted text-foreground"
                    : "rounded-br-sm bg-primary text-primary-foreground"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isLoading && <TypingIndicator />}

          {currentStep >= TOTAL_STEPS && !isLoading && (
            <div className="flex justify-start mb-4">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                Great — I've got what I need. Let's build your day.
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-4">
        <div className="mx-auto w-full max-w-[640px] flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={currentStep >= TOTAL_STEPS ? "All done for today" : "Type your answer…"}
            disabled={isLoading || currentStep >= TOTAL_STEPS}
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || currentStep >= TOTAL_STEPS}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
