import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Palette, Settings, Zap, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Brand = { id: string; name: string; color: string };

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from("brands").select("id,name,color").order("name")
      .then(({ data }) => setBrands(data ?? []));
  }, [path]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight text-sidebar-foreground">Daytask</span>
        </div>

        <nav className="px-3 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.to || (n.to !== "/" && path.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 mt-6 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Brands
        </div>
        <div className="px-3 space-y-0.5 overflow-y-auto flex-1">
          {brands.length === 0 && (
            <div className="px-3 text-xs text-muted-foreground">No brands yet</div>
          )}
          {brands.map((b) => (
            <Link
              key={b.id}
              to="/dashboard"
              search={{ brand: b.id }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
              <span className="truncate">{b.name}</span>
            </Link>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden px-4 py-3 border-b border-border flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Daytask</span>
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
