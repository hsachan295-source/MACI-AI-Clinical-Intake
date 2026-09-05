export const PRIORITY_META = {
  emergency: { label: "Emergency", cls: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  urgent: { label: "Urgent", cls: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  standard: { label: "Standard", cls: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500" },
  routine: { label: "Routine", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
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
