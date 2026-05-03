import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/morning")({
  component: MorningPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Message = { role: "ai" | "user"; content: string; timestamp: Date };

type Brand = {
  id: string;
  name: string;
  description: string | null;
  active_deliverables: string | null;
  color: string;
};

type GeneratedTask = {
  title: string;
  brand_id: string | null;
  priority: number;
  energy_required: string;
  deadline: string | null;
  status: string;
};

// ── Hard-coded question sequence ──────────────────────────────────────────────

const AI_QUESTIONS = [
  "Good morning. Before we build your day, let me ask you a few things. How's your energy today — on a scale of 1 to 10?",
  "Got it. Which brands are you focusing on today? Select all that apply.",
  "Last one — any hard deadlines in the next 48 hours I should know about?",
];

const TOTAL_STEPS = 3; // Q1, Q2, Q3

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1 h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
              style={{
                animationDelay: `${i * 150}ms`,
                animationDuration: "900ms",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function MorningPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const firstName = (() => {
    const meta = user?.user_metadata;
    if (meta?.full_name) return (meta.full_name as string).split(" ")[0];
    if (meta?.name) return (meta.name as string).split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "there";
  })();

  // ── State ──────────────────────────────────────────────────────────────────

  const [brands, setBrands] = useState<Brand[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: AI_QUESTIONS[0], timestamp: new Date() },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch brands on mount ──────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from("brands")
      .select("id,name,description,active_deliverables,color")
      .order("name")
      .then(({ data }) => setBrands((data ?? []) as Brand[]));
  }, []);

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isGenerating]);

  // ── Add a message helper ───────────────────────────────────────────────────

  const addMessage = (role: "ai" | "user", content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date() }]);
  };

  // ── Handle user submitting Q1 or Q3 (text) ────────────────────────────────

  const handleTextSubmit = () => {
    const text = input.trim();
    if (!text || isLoading || isGenerating) return;

    if (currentStep === 0) {
      const n = parseInt(text, 10);
      const energy = isNaN(n) ? 5 : Math.min(10, Math.max(1, n));
      setEnergyLevel(energy);
      addMessage("user", text);
      setInput("");
      setIsLoading(true);
      setTimeout(() => {
        addMessage("ai", AI_QUESTIONS[1]);
        setCurrentStep(1);
        setIsLoading(false);
      }, 750);
    } else if (currentStep === 2) {
      addMessage("user", text);
      setInput("");
      startGeneration(text);
    }
  };

  // ── Handle user confirming Q2 brand chips ─────────────────────────────────

  const handleBrandConfirm = () => {
    if (isLoading || isGenerating) return;
    const label =
      selectedBrandIds.length === 0
        ? "No specific brand — all brands"
        : brands
            .filter((b) => selectedBrandIds.includes(b.id))
            .map((b) => b.name)
            .join(", ");
    addMessage("user", label);
    setIsLoading(true);
    setTimeout(() => {
      addMessage("ai", AI_QUESTIONS[2]);
      setCurrentStep(2);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 700);
  };

  // ── Stream Claude API & save results ──────────────────────────────────────

  const startGeneration = async (deadlineNotes: string) => {
    setIsGenerating(true);
    setCurrentStep(3);

    try {
      const response = await fetch("/api/morning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          energyLevel: energyLevel ?? 5,
          focusBrandIds: selectedBrandIds,
          notes: deadlineNotes,
          brands: brands.map((b) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            active_deliverables: b.active_deliverables,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw) as
              | { type: "delta"; text: string }
              | { type: "done"; tasks: GeneratedTask[] }
              | { type: "error"; message: string };

            if (event.type === "done") {
              await saveTasks(event.tasks, deadlineNotes);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setIsGenerating(false);
      addMessage("ai", `Sorry, something went wrong: ${msg}`);
    }
  };

  // ── Write tasks + session to Supabase ─────────────────────────────────────

  const saveTasks = async (tasks: GeneratedTask[], deadlineNotes: string) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const userId = user?.id;

      if (!userId) throw new Error("Not authenticated");

      // Create morning session record
      const { data: session } = await supabase
        .from("morning_sessions")
        .insert({
          date: today,
          completed: true,
          energy_level: energyLevel,
          focus_brands: selectedBrandIds.length > 0 ? selectedBrandIds : null,
          notes: deadlineNotes.trim() || null,
          user_id: userId,
        })
        .select("id")
        .single();

      const sessionId = session?.id ?? null;

      // Insert tasks
      if (tasks.length > 0) {
        await supabase.from("tasks").insert(
          tasks.map((t) => ({
            title: t.title,
            brand_id: t.brand_id || null,
            priority: t.priority ?? 3,
            energy_required: t.energy_required ?? "medium",
            deadline: t.deadline || null,
            status: "todo",
            created_from: "ai_session",
            session_id: sessionId,
          })) as never
        );
      }

      setIsGenerating(false);
      addMessage(
        "ai",
        `Done. Created ${tasks.length} task${tasks.length !== 1 ? "s" : ""} for your day.`
      );
      setCurrentStep(4);

      setTimeout(() => {
        toast.success("Your day is planned. Let's go.");
        navigate({ to: "/dashboard", search: { brand: undefined } });
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setIsGenerating(false);
      addMessage("ai", `Could not save tasks: ${msg}`);
    }
  };

  // ── Keyboard handler ───────────────────────────────────────────────────────

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  // ── Input area: chips (Q2) vs text (Q1, Q3) ───────────────────────────────

  const showChips = currentStep === 1 && !isLoading;
  const showTextInput =
    (currentStep === 0 || currentStep === 2) && !isLoading && !isGenerating;
  const inputDisabled =
    isLoading || isGenerating || currentStep >= TOTAL_STEPS;

  // ── Render ────────────────────────────────────────────────────────────────

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
              "h-2 w-2 rounded-full transition-colors duration-300",
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

          {(isLoading || isGenerating) && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-4">
        <div className="mx-auto w-full max-w-[640px]">
          {/* Brand chips for Q2 */}
          {showChips && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {brands.map((b) => {
                  const selected = selectedBrandIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() =>
                        setSelectedBrandIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== b.id)
                            : [...prev, b.id]
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: b.color }}
                      />
                      {b.name}
                    </button>
                  );
                })}
                {brands.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No brands yet — tap Confirm to continue.
                  </p>
                )}
              </div>
              <button
                onClick={handleBrandConfirm}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Confirm →
              </button>
            </div>
          )}

          {/* Text input for Q1 and Q3 */}
          {!showChips && (
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={
                  isGenerating
                    ? "Building your day..."
                    : currentStep >= TOTAL_STEPS
                      ? "All done for today"
                      : currentStep === 0
                        ? "Your energy level (1–10)…"
                        : "Any deadlines…"
                }
                disabled={inputDisabled}
                autoFocus={showTextInput}
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleTextSubmit}
                disabled={!input.trim() || inputDisabled}
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
