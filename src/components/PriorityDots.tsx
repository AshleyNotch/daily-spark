export function PriorityDots({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            "h-1.5 w-1.5 rounded-full " +
            (i <= value ? "bg-foreground" : "bg-border")
          }
        />
      ))}
    </div>
  );
}