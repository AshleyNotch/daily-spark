import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, differenceInHours, parseISO } from "date-fns";
import { Plus, Sparkles, MoreHorizontal } from "lucide-react";
import {
  DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import TaskPanel, { TaskRow } from "@/components/TaskPanel";
import { PriorityDots } from "@/components/PriorityDots";
import { EnergyLabel } from "@/components/EnergyLabel";
import { BrandBadge } from "@/components/BrandBadge";

type Brand = { id: string; name: string; color: string };
type Task = TaskRow & { id: string; brand?: Brand | null };

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>) => ({
    brand: typeof s.brand === "string" ? s.brand : undefined,
  }),
  component: () => (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  ),
});

function deadlineUrgent(d?: string | null, status?: string) {
  if (!d || status === "done") return false;
  return differenceInHours(parseISO(d), new Date()) <= 48;
}

function DashboardPage() {
  const { brand: brandFilter } = Route.useSearch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const load = async () => {
    const [{ data: t }, { data: b }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("brands").select("id,name,color"),
    ]);
    const brandList = (b ?? []) as Brand[];
    const map = new Map(brandList.map((x) => [x.id, x]));
    setBrands(brandList);
    setTasks(((t ?? []) as Task[]).map((x) => ({ ...x, brand: x.brand_id ? map.get(x.brand_id) ?? null : null })));
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: s } = await supabase.from("morning_sessions").select("id").eq("date", today).eq("completed", true).maybeSingle();
    setHasSession(!!s);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => (brandFilter ? tasks.filter((t) => t.brand_id === brandFilter) : tasks),
    [tasks, brandFilter]
  );

  const today = format(new Date(), "EEEE, MMM d");

  return (
    <div className="px-6 lg:px-10 py-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Today</div>
          <h1 className="text-2xl font-semibold tracking-tight">{today}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-muted rounded-md p-0.5">
            {(["list", "kanban"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-3 py-1 text-xs font-medium rounded capitalize transition-colors",
                  view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => { setEditing(null); setPanelOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add task
          </Button>
        </div>
      </div>

      {hasSession === false && (
        <Link to="/morning"
          className="mt-5 w-full text-left rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Start your day →</div>
            <div className="text-sm text-muted-foreground">Your AI check-in takes 2 minutes</div>
          </div>
        </Link>
      )}

      {brandFilter && (
        <div className="mt-4 text-sm">
          Filtered by brand —{" "}
          <Link to="/dashboard" search={{ brand: undefined }} className="underline">clear</Link>
        </div>
      )}

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyState onAdd={() => { setEditing(null); setPanelOpen(true); }} />
        ) : view === "list" ? (
          <ListView tasks={filtered} onEdit={(t) => { setEditing(t); setPanelOpen(true); }} onChanged={load} />
        ) : (
          <KanbanView tasks={filtered} onEdit={(t) => { setEditing(t); setPanelOpen(true); }} onChanged={load} />
        )}
      </div>

      <TaskPanel open={panelOpen} onOpenChange={setPanelOpen} task={editing} brands={brands} onSaved={load} />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 px-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-foreground font-medium">No tasks yet</p>
      <p className="text-sm text-muted-foreground mt-1">Start your morning check-in or add a task manually.</p>
      <Button className="mt-5" onClick={onAdd}><Plus className="h-4 w-4 mr-1" /> Add task</Button>
    </div>
  );
}

function ListView({ tasks, onEdit, onChanged }: { tasks: Task[]; onEdit: (t: Task) => void; onChanged: () => void }) {
  const grouped = useMemo(() => {
    const m = new Map<number, Task[]>();
    [...tasks].sort((a, b) => b.priority - a.priority).forEach((t) => {
      if (!m.has(t.priority)) m.set(t.priority, []);
      m.get(t.priority)!.push(t);
    });
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [tasks]);

  const toggleDone = async (t: Task) => {
    await supabase.from("tasks").update({ status: t.status === "done" ? "todo" : "done" }).eq("id", t.id);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_140px_120px_100px_90px] gap-4 px-5 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
        <div /><div>Title</div><div>Brand</div><div>Deadline</div><div>Priority</div><div>Energy</div>
      </div>
      {grouped.map(([prio, items]) => (
        <div key={prio}>
          <div className="px-5 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">Priority {prio}</div>
          {items.map((t) => (
            <button key={t.id} onClick={() => onEdit(t)}
              className="w-full grid grid-cols-[auto_1fr_140px_120px_100px_90px] gap-4 px-5 py-3 border-t border-border items-center text-left hover:bg-accent/40 transition-colors">
              <div onClick={(e) => { e.stopPropagation(); toggleDone(t); }}>
                <Checkbox checked={t.status === "done"} />
              </div>
              <div className={cn("text-sm font-medium truncate", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</div>
              <div>{t.brand && <BrandBadge name={t.brand.name} color={t.brand.color} />}</div>
              <div className={cn("text-xs", deadlineUrgent(t.deadline, t.status) ? "text-rose-600 font-medium" : "text-muted-foreground")}>
                {t.deadline ? format(parseISO(t.deadline), "MMM d") : "—"}
              </div>
              <div><PriorityDots value={t.priority} /></div>
              <div><EnergyLabel value={t.energy_required} /></div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

const COLS = [{ id: "todo", label: "To Do" }, { id: "in_progress", label: "In Progress" }, { id: "done", label: "Done" }];

function KanbanView({ tasks, onEdit, onChanged }: { tasks: Task[]; onEdit: (t: Task) => void; onChanged: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const id = e.active.id as string;
    const status = e.over?.id as string | undefined;
    if (!status) return;
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    await supabase.from("tasks").update({ status }).eq("id", id);
    onChanged();
  };

  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    onChanged();
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLS.map((c) => {
          const items = tasks.filter((t) => t.status === c.id);
          return (
            <KanbanColumn key={c.id} id={c.id} label={c.label} count={items.length}>
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">Drop tasks here</div>
              )}
              {items.map((t) => (
                <KanbanCard key={t.id} task={t} onEdit={() => onEdit(t)} onDelete={() => remove(t.id)} />
              ))}
            </KanbanColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("rounded-xl bg-muted/40 p-3 transition-colors", isOver && "bg-muted")}>
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KanbanCard({ task, onEdit, onDelete }: { task: Task; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 } : undefined;
  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-3 group">
      <div className="flex items-start gap-2">
        <div {...listeners} {...attributes} className="flex-1 cursor-grab active:cursor-grabbing">
          <div className="text-sm font-medium leading-snug">{task.title}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.brand && <BrandBadge name={task.brand.name} color={task.brand.color} />}
            {task.deadline && (
              <span className={cn("text-[11px]", deadlineUrgent(task.deadline, task.status) ? "text-rose-600 font-medium" : "text-muted-foreground")}>
                {format(parseISO(task.deadline), "MMM d")}
              </span>
            )}
            <PriorityDots value={task.priority} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
