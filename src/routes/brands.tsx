import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { BRAND_COLORS, randomBrandColor } from "@/lib/brand-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/brands")({
  component: () => <AppLayout><BrandsPage /></AppLayout>,
});

type Brand = {
  id: string; name: string; description: string | null;
  active_deliverables: string | null; color: string;
};

function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const load = async () => {
    const [{ data: b }, { data: t }] = await Promise.all([
      supabase.from("brands").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("brand_id"),
    ]);
    setBrands((b ?? []) as Brand[]);
    const c: Record<string, number> = {};
    (t ?? []).forEach((x: { brand_id: string | null }) => {
      if (x.brand_id) c[x.brand_id] = (c[x.brand_id] ?? 0) + 1;
    });
    setCounts(c);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this brand?")) return;
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Brand deleted");
    load();
  };

  return (
    <div className="px-6 lg:px-10 py-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Add your first brand to get started</p>
          <p className="text-sm text-muted-foreground mt-1">Group tasks by client and give context to your AI check-in.</p>
          <Button className="mt-5" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add brand
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => (
            <div key={b.id} className="bg-card border border-border rounded-xl p-5 border-l-4 group" style={{ borderLeftColor: b.color }}>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg truncate">{b.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{b.description || "No description"}</p>
              </div>
              <div className="mt-4 text-xs text-muted-foreground line-clamp-1">
                <span className="font-medium text-foreground">Active: </span>{b.active_deliverables || "—"}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{counts[b.id] ?? 0} tasks</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BrandDialog open={open} onOpenChange={setOpen} brand={editing} onSaved={load} />
    </div>
  );
}

function BrandDialog({ open, onOpenChange, brand, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; brand: Brand | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [deliv, setDeliv] = useState("");
  const [color, setColor] = useState(randomBrandColor());

  useEffect(() => {
    if (open) {
      setName(brand?.name ?? "");
      setDesc(brand?.description ?? "");
      setDeliv(brand?.active_deliverables ?? "");
      setColor(brand?.color ?? randomBrandColor());
    }
  }, [open, brand]);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    const payload = { name: name.trim(), description: desc || null, active_deliverables: deliv || null, color };
    const { error } = brand
      ? await supabase.from("brands").update(payload).eq("id", brand.id)
      : await supabase.from("brands").insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success(brand ? "Brand updated" : "Brand added");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{brand ? "Edit brand" : "New brand"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} placeholder="What this client does, their tone, relationship context" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Active deliverables</Label>
            <Textarea rows={2} placeholder="What's currently in progress for this brand" value={deliv} onChange={(e) => setDeliv(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn("h-7 w-7 rounded-full transition-transform", color === c && "ring-2 ring-offset-2 ring-foreground scale-110")}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
