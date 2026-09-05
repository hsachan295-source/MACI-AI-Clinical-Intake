import { useEffect } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { priorityMeta } from "../lib/format";

export function Button({ variant = "primary", className = "", loading, children, ...props }) {
  const cls = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    outline: "btn-outline",
    danger: "btn-danger",
  }[variant];
  return (
    <button className={`${cls} px-4 py-2.5 ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-clinical-ink">{children}</h2>
      {hint && <p className="mt-0.5 text-sm text-clinical-muted">{hint}</p>}
    </div>
  );
}

export function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const m = priorityMeta(priority);
  return (
    <Badge className={m.cls}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </Badge>
  );
}

export function RedFlagPill({ children = "Red flag" }) {
  return (
    <Badge className="border-rose-200 bg-rose-50 text-rose-700">
      <AlertTriangle className="h-3 w-3" />
      {children}
    </Badge>
  );
}

export function Spinner({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-clinical-muted ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-clinical-line bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-clinical-bg p-3">
        <Icon className="h-6 w-6 text-clinical-muted" />
      </div>
      <p className="font-semibold text-clinical-ink">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-clinical-muted">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-rose-500" />
      <p className="mt-2 font-semibold text-rose-800">{title}</p>
      {message && <p className="mt-1 text-sm text-rose-700">{message}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-clinical-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} animate-fade-in rounded-2xl bg-white shadow-pop`}
      >
        <div className="flex items-center justify-between border-b border-clinical-line px-5 py-3.5">
          <h3 className="font-bold text-clinical-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-clinical-line/60" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-clinical-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, required, children }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-clinical-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function TextInput(props) {
  return <input {...props} className={`input ${props.className || ""}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`input min-h-[110px] resize-y ${props.className || ""}`} />;
}

export function Select({ options = [], className = "", ...props }) {
  return (
    <select {...props} className={`input ${className}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, id }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-clinical-line bg-white p-3 hover:bg-clinical-bg">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-clinical-line text-brand-600 focus:ring-brand-400"
      />
      <span className="text-sm text-clinical-ink">{label}</span>
    </label>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = "brand" }) {
  const toneCls = {
    brand: "bg-brand-50 text-brand-700",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-clinical-muted">{label}</p>
        {Icon && (
          <span className={`rounded-lg p-1.5 ${toneCls}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-clinical-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-clinical-muted">{sub}</p>}
    </Card>
  );
}

export function AiDraftNotice({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ${className}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      AI-generated draft. Requires clinician review.
    </div>
  );
}
