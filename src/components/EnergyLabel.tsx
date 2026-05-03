import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

export function EnergyLabel({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
        styles[value] ?? styles.medium
      )}
    >
      {value}
    </span>
  );
}