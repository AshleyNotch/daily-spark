import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate, e as useRouterState, L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useAuth, s as supabase } from "./router-Ch21li1S.mjs";
import { c as cn, B as Button } from "./input-CpK8RbKS.mjs";
import { R as Root } from "../_libs/radix-ui__react-label.mjs";
import { c as cva } from "../_libs/class-variance-authority.mjs";
import { Z as Zap, L as LayoutDashboard, f as Palette, g as Settings, h as LogOut, M as Menu } from "../_libs/lucide-react.mjs";
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/settings", label: "Settings", icon: Settings }
];
function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [brands, setBrands] = reactExports.useState([]);
  const [open, setOpen] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/" });
  }, [user, loading, navigate]);
  reactExports.useEffect(() => {
    if (!user) return;
    supabase.from("brands").select("id,name,color").order("name").then(({ data }) => setBrands(data ?? []));
  }, [user, path]);
  if (loading || !user) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-screen flex items-center justify-center text-muted-foreground", children: "Loading…" });
  }
  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-screen flex w-full bg-background", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "aside",
      {
        className: cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        ),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-5 py-5 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Zap, { className: "h-4 w-4" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold tracking-tight text-sidebar-foreground", children: "Daytask" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "px-3 space-y-1", children: NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.to || n.to !== "/" && path.startsWith(n.to);
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Link,
              {
                to: n.to,
                onClick: () => setOpen(false),
                className: cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                ),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "h-4 w-4" }),
                  n.label
                ]
              },
              n.to
            );
          }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-5 mt-6 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground", children: "Brands" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-3 space-y-0.5 overflow-y-auto flex-1", children: [
            brands.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 text-xs text-muted-foreground", children: "No brands yet" }),
            brands.map((b) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Link,
              {
                to: "/dashboard",
                search: { brand: b.id },
                className: "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-2.5 w-2.5 rounded-full", style: { background: b.color } }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: b.name })
                ]
              },
              b.id
            ))
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-sidebar-border p-3 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold", children: user.email?.[0]?.toUpperCase() }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 min-w-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs truncate text-sidebar-foreground", children: user.email }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon", onClick: logout, "aria-label": "Log out", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "h-4 w-4" }) })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lg:hidden px-4 py-3 border-b border-border flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon", onClick: () => setOpen((o) => !o), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Menu, { className: "h-5 w-5" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Daytask" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "flex-1 min-w-0", children })
    ] })
  ] });
}
const Textarea = reactExports.forwardRef(
  ({ className, ...props }, ref) => {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "textarea",
      {
        className: cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        ),
        ref,
        ...props
      }
    );
  }
);
Textarea.displayName = "Textarea";
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);
const Label = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(Root, { ref, className: cn(labelVariants(), className), ...props }));
Label.displayName = Root.displayName;
export {
  AppLayout as A,
  Label as L,
  Textarea as T
};
