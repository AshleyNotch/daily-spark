import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type TaskRow = {
  id?: string;
  title: string;
  description?: string | null;
  brand_id?: string | null;
  status: string;
  priority: number;
  energy_required: string;
  deadline?: string | null;
  estimated_minutes?: number | null;
};

type Brand = { id: string; name: string };

export default function TaskPanel({
  open, onOpenChange, task, brands, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow | null;
  brands: Brand[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TaskRow>({
    title: "", status: "todo", priority: 3, energy_required: "medium",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(task ?? { title: "", status: "todo", priority: 3, energy_required: "medium" });
  }, [open, task]);

  const update = (p: Partial<TaskRow>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      brand_id: form.brand_id || null,
      status: form.status,
      priority: form.priority,
      energy_required: form.energy_required,
      deadline: form.deadline || null,
      estimated_minutes: form.estimated_minutes || null,
    };
    const { error } = form.id
      ? await supabase.from("tasks").update(payload).eq("id", form.id)
      : await supabase.from("tasks").insert({ ...payload, created_from: "manual" } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Task updated" : "Task created");
    onSaved();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!form.id) return;
    const { error } = await supabase.from("tasks").delete().eq("id", form.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{form.id ? "Edit task" : "New task"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => update({ title: e.target.value })} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Select value={form.brand_id ?? "none"} onValueChange={(v) => update({ brand_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No brand / Internal</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <Input type="date" value={form.deadline ?? ""} onChange={(e) => update({ deadline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((p) => (
                <button key={p} type="button" onClick={() => update({ priority: p })}
                  className={cn("flex-1 py-1.5 rounded-md text-xs border",
                    form.priority === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                  )}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Energy required</Label>
            <div className="grid grid-cols-3 gap-1">
              {["low", "medium", "high"].map((e) => (
                <button key={e} type="button" onClick={() => update({ energy_required: e })}
                  className={cn("py-1.5 rounded-md text-xs border capitalize",
                    form.energy_required === e ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                  )}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estimated time (minutes)</Label>
            <Input type="number" value={form.estimated_minutes ?? ""}
              onChange={(e) => update({ estimated_minutes: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save task"}
            </Button>
            {form.id && <Button variant="outline" onClick={remove}>Delete</Button>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
