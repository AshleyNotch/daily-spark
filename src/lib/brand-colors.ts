export const BRAND_COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#10b981",
  "#14b8a6", "#0ea5e9", "#a855f7", "#ef4444",
  "#eab308", "#84cc16",
];
export const randomBrandColor = () =>
  BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];