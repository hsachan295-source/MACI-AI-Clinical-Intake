// Theme-aware priority palettes (semantic tokens → adapt to light / dark).
export const PRIORITY_META = {
  emergency: { label: "Emergency", cls: "bg-critical/12 text-critical border-critical/30", dot: "bg-critical" },
  urgent: { label: "Urgent", cls: "bg-warning/12 text-warning border-warning/30", dot: "bg-warning" },
  standard: { label: "Standard", cls: "bg-primary/10 text-primary border-primary/25", dot: "bg-primary" },
  routine: { label: "Routine", cls: "bg-success/12 text-success border-success/25", dot: "bg-success" },
};

export const STATUS_LABEL = {
  created: "Created",
  in_progress: "In progress",
  awaiting_documents: "Awaiting documents",
  summary_ready: "Summary ready",
  submitted: "Submitted",
  reviewed: "Reviewed",
  cancelled: "Cancelled",
};

export function priorityMeta(p) {
  return PRIORITY_META[p] || PRIORITY_META.standard;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function titleCase(s = "") {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function nonEmpty(arr) {
  return Array.isArray(arr) && arr.length > 0;
}
