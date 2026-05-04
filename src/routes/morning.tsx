import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle, RotateCcw, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PriorityDots } from "@/components/PriorityDots";
import { EnergyLabel } from "@/components/EnergyLabel";

export const Route = createFileRoute("/morning")({
  component: MorningPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const Q1 =
  "Good morning. Let's build your day. First — how's your energy feeling today, on a scale of 1 to 10?";
const Q2 =
  "Got it. Which brands or clients are you focusing on today? You can select from below or just tell me.";
const Q2_NO_BRANDS =
  "I notice you haven't added any brands yet. I'll create tasks without brand context for now — you can add brands later in the Brands page.";
const Q3 =
  "Last one — any hard deadlines or time-sensitive things I should know about in the next 48 hours? If nothing urgent, just say 'all clear'.";
const PLANNING = "Perfect. Give me a moment to plan your day...";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatStep = "init" | "q1" | "q2" | "q3" | "generating" | "summary" | "error";

type Message = { id: string; role: "ai" | "user"; content: string };

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

type BrandMemorySession = {
  session_date: string;
  tasks_created: number;
  tasks_completed: number;
  tasks_incomplete: number;
  incomplete_task_titles: string[];
  session_notes: string;
};

type BrandMemoryItem = {
  brand_name: string;
  recent_sessions: BrandMemorySession[];
};

// ── Utilities ─────────────────────────────────────────────────────────────────

let _id = 0;
const nid = () => `m${++_id}`;

function parseEnergy(text: string): number {
  const n = parseInt(text.trim(), 10);
  if (!isNaN(n)) return Math.min(10, Math.max(1, n));
  const lower = text.toLowerCase();
  if (/great|amazing|excellent|fantastic|awesome|wonderful/.test(lower)) return 9;
  if (/good|well|solid|strong|great/.test(lower)) return 7;
  if (/okay|ok|fine|alright|decent|average|medium/.test(lower)) return 5;
  if (/tired|low|drained|bad|rough|meh|not great/.test(lower)) return 3;
  if (/terrible|awful|exhausted|horrible|dead/.test(lower)) return 2;
  return 5;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
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

// ── Main page ─────────────────────────────────────────────────────────────────

function MorningPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE, MMM d");

  // ── State ──────────────────────────────────────────────────────────────────

  const [step, setStep] = useState<ChatStep>("init");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryTasks, setSummaryTasks] = useState<GeneratedTask[]>([]);
  const [countdown, setCountdown] = useState(8);
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);

  // Refs avoid stale-closure issues in async handlers
  const energyRef = useRef(5);
  const focusBrandsRef = useRef<string[]>([]);
  const deadlineRef = useRef("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load brands ────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from("brands")
      .select("id,name,description,active_deliverables,color")
      .order("name")
      .then(({ data }) => setBrands((data ?? []) as Brand[]));
  }, []);

  // ── Fire first message after 600ms ─────────────────────────────────────────

  useEffect(() => {
    if (step !== "init") return;
    const t = setTimeout(async () => {
      await showAiMsg(Q1, 0);
      setStep("q1");
    }, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isSubmitting]);

  // ── Countdown for summary auto-redirect ───────────────────────────────────

  useEffect(() => {
    if (step !== "summary") return;
    const t = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(t);
          navigate({ to: "/dashboard", search: { brand: undefined } });
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addUserMsg = (content: string) =>
    setMessages((prev) => [...prev, { id: nid(), role: "user", content }]);

  const showAiMsg = (content: string, delay = 800) =>
    new Promise<void>((resolve) => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, { id: nid(), role: "ai", content }]);
        resolve();
      }, delay);
    });

  // ── Skip for today ─────────────────────────────────────────────────────────

  const skipForToday = async () => {
    if (user) {
      await supabase.from("morning_sessions").upsert({
        date: today,
        completed: true,
        energy_level: null,
        focus_brands: null,
        notes: null,
        user_id: user.id,
      });
    }
    navigate({ to: "/dashboard", search: { brand: undefined } });
  };

  // ── Question handlers ──────────────────────────────────────────────────────

  const handleQ1 = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    const energy = parseEnergy(text);
    energyRef.current = energy;
    addUserMsg(text);
    setInput("");
    if (brands.length === 0) {
      await showAiMsg(Q2_NO_BRANDS);
      await showAiMsg(Q3);
      setStep("q3");
    } else {
      await showAiMsg(Q2);
      setStep("q2");
    }
  };

  const handleQ2 = async () => {
    if (isTyping) return;
    const selectedNames = brands
      .filter((b) => selectedBrandIds.includes(b.id))
      .map((b) => b.name);
    focusBrandsRef.current = selectedNames;
    const parts = [...selectedNames, ...(input.trim() ? [input.trim()] : [])];
    const userText = parts.join(", ") || "No specific focus today";
    addUserMsg(userText);
    setInput("");
    await showAiMsg(Q3);
    setStep("q3");
  };

  const handleQ3 = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    deadlineRef.current = text;
    addUserMsg(text);
    setInput("");
    setStep("generating");
    await showAiMsg(PLANNING);
    callEdgeFunction();
  };

  const handleSend = () => {
    if (step === "q1") handleQ1();
    else if (step === "q2") handleQ2();
    else if (step === "q3") handleQ3();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Edge function call ─────────────────────────────────────────────────────

  const callEdgeFunction = async () => {
    setIsSubmitting(true);

    // Build conversation for Claude (exclude the planning message we just added)
    const conversationMsgs = messages
      .filter((m) => m.content !== PLANNING)
      .map((m) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      }));

    try {
      // Fetch brand memory for focused brands only
      let brandMemory: BrandMemoryItem[] = [];
      const focusNames = focusBrandsRef.current;
      if (focusNames.length > 0) {
        const focusBrandIds = brands
          .filter((b) => focusNames.includes(b.name))
          .map((b) => b.id);

        if (focusBrandIds.length > 0) {
          const { data: memRows } = await supabase
            .from("brand_memory")
            .select(
              "brand_id, session_date, tasks_created, tasks_completed, tasks_incomplete, incomplete_task_titles, session_notes"
            )
            .in("brand_id", focusBrandIds)
            .order("session_date", { ascending: false });

          if (memRows && memRows.length > 0) {
            const grouped = new Map<string, typeof memRows[number][]>();
            for (const row of memRows) {
              const arr = grouped.get(row.brand_id) ?? [];
              if (arr.length < 3) {
                arr.push(row);
                grouped.set(row.brand_id, arr);
              }
            }
            for (const [brandId, rows] of grouped) {
              const brand = brands.find((b) => b.id === brandId);
              if (!brand) continue;
              brandMemory.push({
                brand_name: brand.name,
                recent_sessions: rows.map((r) => ({
                  session_date: r.session_date,
                  tasks_created: r.tasks_created,
                  tasks_completed: r.tasks_completed,
                  tasks_incomplete: r.tasks_incomplete,
                  incomplete_task_titles: r.incomplete_task_titles ?? [],
                  session_notes: r.session_notes ?? "",
                })),
              });
            }
          }
        }
      }

      const { data, error } = await supabase.functions.invoke("morning-checkin", {
        body: {
          messages: conversationMsgs,
          brands: brands.map((b) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            active_deliverables: b.active_deliverables,
          })),
          sessionData: {
            energyLevel: energyRef.current,
            focusBrands: focusBrandsRef.current,
            notes: deadlineRef.current,
          },
          brandMemory: brandMemory.length > 0 ? brandMemory : undefined,
          date: today,
        },
      });

      if (error) throw new Error(error.message);

      if (!data?.tasks || !Array.isArray(data.tasks)) {
        throw new Error("malformed_json");
      }

      await saveSession(data.tasks as GeneratedTask[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setIsSubmitting(false);

      const isMalformed = msg === "malformed_json";
      const errorText = isMalformed
        ? "I had trouble formatting your tasks. Want to try again?"
        : "Something went wrong with the AI. You can try again or skip for today.";

      // Replace the "planning" bubble with the error message
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { id: nid(), role: "ai", content: errorText },
      ]);

      setRetryFn(() => () => {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { id: nid(), role: "ai", content: PLANNING },
        ]);
        setIsSubmitting(true);
        setRetryFn(null);
        callEdgeFunction();
      });

      setStep("error");
    }
  };

  // ── Write brand memory (silent, fire-and-forget) ──────────────────────────

  const writeBrandMemory = async (tasks: GeneratedTask[], sessionId: string | null) => {
    try {
      if (!user?.id) return;

      // Group this session's tasks by resolved brand_id
      const tasksByBrand = new Map<string, string[]>();
      for (const task of tasks) {
        if (!task.brand_id) continue;
        const arr = tasksByBrand.get(task.brand_id) ?? [];
        arr.push(task.title);
        tasksByBrand.set(task.brand_id, arr);
      }
      if (tasksByBrand.size === 0) return;

      // Fetch current status of ALL tasks for these brands
      const brandIds = Array.from(tasksByBrand.keys());
      const { data: allBrandTasks } = await supabase
        .from("tasks")
        .select("brand_id, title, status")
        .in("brand_id", brandIds);

      const sessionDate = format(new Date(), "yyyy-MM-dd");
      const rows = [];

      for (const [brandId, createdTitles] of tasksByBrand) {
        const brand = brands.find((b) => b.id === brandId);
        const allForBrand = (allBrandTasks ?? []).filter((t) => t.brand_id === brandId);
        const completedCount = allForBrand.filter((t) => t.status === "done").length;
        const incompleteRows = allForBrand.filter((t) => t.status !== "done");

        const brandNotes =
          brand && deadlineRef.current.toLowerCase().includes(brand.name.toLowerCase())
            ? deadlineRef.current
            : null;

        rows.push({
          user_id: user.id,
          brand_id: brandId,
          session_id: sessionId,
          session_date: sessionDate,
          tasks_created: createdTitles.length,
          tasks_completed: completedCount,
          tasks_incomplete: incompleteRows.length,
          incomplete_task_titles: incompleteRows.slice(0, 10).map((t) => t.title),
          session_notes: brandNotes,
        });
      }

      if (rows.length > 0) {
        await supabase.from("brand_memory").insert(rows as never);
      }
    } catch {
      // fail silently — tasks are more important than memory
    }
  };

  // ── Save to Supabase ───────────────────────────────────────────────────────

  const saveSession = async (tasks: GeneratedTask[]) => {
    try {
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const brandNameToId = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));

      const { data: session } = await supabase
        .from("morning_sessions")
        .insert({
          date: today,
          completed: true,
          energy_level: energyRef.current,
          focus_brands: focusBrandsRef.current.length > 0 ? focusBrandsRef.current : null,
          notes: deadlineRef.current || null,
          user_id: userId,
        })
        .select("id")
        .single();

      const sid = session?.id ?? null;

      if (tasks.length > 0) {
        await supabase.from("tasks").insert(
          tasks.map((t) => {
            // brand_id may be a UUID or a name; resolve both
            const resolvedBrandId =
              t.brand_id && brands.some((b) => b.id === t.brand_id)
                ? t.brand_id
                : brandNameToId.get((t.brand_id ?? "").toLowerCase()) ?? null;
            return {
              title: t.title,
              brand_id: resolvedBrandId,
              priority: t.priority ?? 3,
              energy_required: t.energy_required ?? "medium",
              deadline: t.deadline || null,
              status: "todo",
              created_from: "ai_session",
              session_id: sid,
            };
          }) as never
        );
      }

      // Write memory silently — don't await, don't block summary
      writeBrandMemory(tasks, sid);

      setSummaryTasks(tasks);
      setIsSubmitting(false);
      setStep("summary");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setIsSubmitting(false);
      setMessages((prev) => [
        ...prev,
        { id: nid(), role: "ai", content: `Tasks generated but couldn't save: ${msg}` },
      ]);
    }
  };

  // ── Derived UI state ───────────────────────────────────────────────────────

  const filledDots = step === "q1" ? 1 : step === "q2" ? 2 : 3;
  const inputDisabled =
    isTyping || isSubmitting || !["q1", "q2", "q3"].includes(step);
  const sendDisabled =
    inputDisabled ||
    (step !== "q2" && !input.trim());

  // ── Summary view ──────────────────────────────────────────────────────────

  if (step === "summary") {
    const brandMap = new Map(brands.map((b) => [b.id, b]));

    // Group tasks by brand
    const groups: Array<{ brand: Brand | null; key: string; tasks: GeneratedTask[] }> = [];
    const seen = new Map<string, number>();
    for (const task of summaryTasks) {
      const key = task.brand_id ?? "none";
      if (!seen.has(key)) {
        seen.set(key, groups.length);
        groups.push({
          key,
          brand: task.brand_id ? (brandMap.get(task.brand_id) ?? null) : null,
          tasks: [],
        });
      }
      groups[seen.get(key)!].tasks.push(task);
    }

    let cardIndex = 0;

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span className="font-semibold text-foreground">Morning check-in</span>
          <span className="text-sm text-muted-foreground">{todayLabel}</span>
        </header>

        <div className="flex-1 overflow-y-auto py-8">
          <div className="mx-auto w-full max-w-[600px] px-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Your day is planned.</h1>
                <p className="text-sm text-muted-foreground">
                  {summaryTasks.length} task{summaryTasks.length !== 1 ? "s" : ""} created for today
                </p>
              </div>
            </div>

            {/* Task groups */}
            {groups.map((group) => (
              <div key={group.key} className="mb-5">
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.brand ? (
                    <>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: group.brand.color }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.brand.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      General
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {group.tasks.map((task) => {
                    const idx = cardIndex++;
                    return (
                      <div
                        key={idx}
                        className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-1"
                        style={{
                          animationDelay: `${idx * 50}ms`,
                          animationDuration: "250ms",
                          animationFillMode: "both",
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{task.title}</div>
                          {task.deadline && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Due {format(new Date(task.deadline), "MMM d")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityDots value={task.priority} />
                          <EnergyLabel value={task.energy_required} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="mt-8 space-y-3">
              <button
                onClick={() =>
                  navigate({ to: "/dashboard", search: { brand: undefined } })
                }
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Let's go →
              </button>
              <button
                onClick={() =>
                  navigate({ to: "/dashboard", search: { brand: undefined } })
                }
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Add more tasks manually
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">
                Taking you to dashboard in {countdown}s…
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat view ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Morning check-in</span>
          <span className="text-sm text-muted-foreground hidden sm:block">{todayLabel}</span>
        </div>
        <button
          onClick={skipForToday}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for today
        </button>
      </header>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2.5 pt-5 pb-1 shrink-0">
        {[1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={cn(
              "h-2 w-2 rounded-full transition-all duration-300",
              dot <= filledDots
                ? "bg-primary scale-110"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto w-full max-w-[600px] px-4 flex flex-col">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex mb-4", m.role === "user" ? "justify-end" : "justify-start")}
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

          {(isTyping || (isSubmitting && step === "generating")) && <TypingIndicator />}

          {/* Retry / skip buttons after error */}
          {step === "error" && (
            <div className="flex gap-2 mb-4 justify-start">
              {retryFn && (
                <button
                  onClick={() => {
                    setStep("generating");
                    retryFn();
                  }}
                  className="flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 border border-border px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Try again
                </button>
              )}
              <button
                onClick={skipForToday}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
              >
                Skip for today
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — hidden during generating / summary / error */}
      {["q1", "q2", "q3"].includes(step) && (
        <div className="shrink-0 border-t border-border bg-background px-4 py-4">
          <div className="mx-auto w-full max-w-[600px]">
            {/* Brand chips shown for Q2 */}
            {step === "q2" && !isTyping && brands.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {brands.map((b) => {
                  const sel = selectedBrandIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() =>
                        setSelectedBrandIds((prev) =>
                          sel ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all",
                        sel
                          ? "font-medium border-2"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                      style={
                        sel
                          ? {
                              borderColor: b.color,
                              color: b.color,
                              background: `${b.color}1a`,
                            }
                          : {}
                      }
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: b.color }}
                      />
                      {b.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Text input + send */}
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  step === "q1"
                    ? "Your energy level (1–10)…"
                    : step === "q2"
                      ? "Or just type a brand name…"
                      : "Any deadlines, or 'all clear'…"
                }
                disabled={inputDisabled}
                autoFocus={!inputDisabled}
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={sendDisabled}
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
