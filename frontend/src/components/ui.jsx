import { Children, cloneElement, useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Inbox, Loader2, Sparkles, X } from "lucide-react";
import { priorityMeta } from "../lib/format";
import { AnimatedNumber, EASE } from "../lib/motion.jsx";

export const cx = (...a) => a.filter(Boolean).join(" ");
const MDiv = motion.div;

/* --------------------------------------------------------------------- */
/* Buttons                                                                */
/* --------------------------------------------------------------------- */
const BTN_VARIANT = {
  primary: "btn-primary",
  solid: "btn-solid",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
};
const BTN_SIZE = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-[15px]",
  xl: "h-14 px-7 text-base rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled,
  children,
  ...props
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={cx(BTN_VARIANT[variant] || BTN_VARIANT.primary, BTN_SIZE[size], className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

export function IconButton({ label, className = "", children, ...props }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={reduce ? undefined : { scale: 0.92 }}
      aria-label={label}
      title={label}
      className={cx("btn-outline grid h-9 w-9 place-items-center rounded-xl p-0", className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* --------------------------------------------------------------------- */
/* Surfaces                                                               */
/* --------------------------------------------------------------------- */
export function Card({ as = "div", glass = false, hover = false, className = "", children, ...rest }) {
  const Comp = as === "div" ? "div" : as;
  return (
    <Comp className={cx(glass ? "glass" : "card", hover && "card-hover", className)} {...rest}>
      {children}
    </Comp>
  );
}

export const GlassCard = (p) => <Card glass {...p} />;

export function SectionTitle({ children, hint, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-fg">{children}</h2>
        {hint && <p className="mt-1 text-sm text-fg-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-elevated text-primary shadow-inset">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Badges / pills                                                         */
/* --------------------------------------------------------------------- */
const TONE = {
  neutral: "border-border bg-elevated text-fg-muted",
  primary: "border-primary/25 bg-primary/10 text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  success: "border-success/25 bg-success/12 text-success",
  warning: "border-warning/25 bg-warning/12 text-warning",
  danger: "border-danger/25 bg-danger/12 text-danger",
  critical: "border-critical/30 bg-critical/12 text-critical",
};

export function Badge({ tone, className = "", children }) {
  // `tone` picks a theme-aware palette; a raw `className` still works as override.
  const palette = tone ? TONE[tone] || TONE.neutral : className || TONE.neutral;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        palette,
        tone ? className : ""
      )}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const m = priorityMeta(priority);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        m.cls
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function RedFlagPill({ children = "Red flag", pulse = true }) {
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-full border border-critical/35 bg-critical/12 px-2.5 py-0.5 text-xs font-bold text-critical">
      {pulse && (
        <span className="absolute -left-0.5 -top-0.5 h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical/60" />
        </span>
      )}
      <AlertTriangle className="h-3 w-3" />
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------- */
/* Alert                                                                  */
/* --------------------------------------------------------------------- */
const ALERT_TONE = {
  info: { wrap: "border-primary/25 bg-primary/8", icon: "text-primary", head: "text-fg" },
  success: { wrap: "border-success/25 bg-success/10", icon: "text-success", head: "text-fg" },
  warning: { wrap: "border-warning/30 bg-warning/10", icon: "text-warning", head: "text-fg" },
  danger: { wrap: "border-danger/30 bg-danger/10", icon: "text-danger", head: "text-fg" },
  critical: { wrap: "border-critical/40 bg-critical/10", icon: "text-critical", head: "text-fg" },
};

export function Alert({ tone = "info", title, icon: Icon = AlertTriangle, children, className = "" }) {
  const t = ALERT_TONE[tone] || ALERT_TONE.info;
  return (
    <div role="alert" className={cx("flex gap-3 rounded-2xl border p-4", t.wrap, className)}>
      <Icon className={cx("mt-0.5 h-5 w-5 shrink-0", t.icon)} />
      <div className="min-w-0 text-sm">
        {title && <p className={cx("font-bold", t.head)}>{title}</p>}
        {children && <div className={cx("text-fg-muted", title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}

export function AiDraftNotice({ className = "" }) {
  return (
    <div
      className={cx(
        "flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning",
        className
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      AI-generated draft — requires clinician review.
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Loading / AI status                                                    */
/* --------------------------------------------------------------------- */
export function Spinner({ label = "Loading…", className = "" }) {
  return (
    <div className={cx("flex items-center gap-2 text-sm text-fg-muted", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/** Cycling AI processing indicator with an orbiting dot. */
export function AIStatus({ steps, active, done = false, className = "" }) {
  const list = Array.isArray(steps) ? steps : [steps];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2 || done) return undefined;
    const id = setInterval(() => setI((v) => (v + 1) % list.length), 1900);
    return () => clearInterval(id);
  }, [list.length, done]);
  const text = active || list[i] || "Working…";
  return (
    <div className={cx("flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/8 px-3.5 py-2.5", className)}>
      <span className="relative grid h-5 w-5 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/25" />
        <motion.span
          className="absolute h-1.5 w-1.5 rounded-full bg-primary"
          style={{ top: -1, left: "50%", marginLeft: -3 }}
          animate={done ? {} : { rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
        />
        {done && <Check className="h-3.5 w-3.5 text-success" />}
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={text}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-medium text-fg"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={cx("skeleton", className)} />;
}
export function SkeletonRows({ rows = 4, className = "" }) {
  return (
    <div className={cx("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
export function SkeletonCard({ className = "" }) {
  return (
    <Card className={cx("space-y-3 p-5", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </Card>
  );
}

/* --------------------------------------------------------------------- */
/* Empty / error                                                          */
/* --------------------------------------------------------------------- */
export function EmptyState({ icon: Icon = Inbox, title, subtitle, action, className = "" }) {
  return (
    <MDiv
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cx(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center",
        className
      )}
    >
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-elevated text-fg-subtle">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-semibold text-fg">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-fg-muted">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </MDiv>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className = "" }) {
  return (
    <div className={cx("rounded-2xl border border-danger/30 bg-danger/8 px-5 py-8 text-center", className)}>
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="font-semibold text-fg">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Overlays: Modal + Drawer                                               */
/* --------------------------------------------------------------------- */
function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[rgb(var(--shadow)/0.5)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            className={cx(
              "relative z-10 w-full overflow-hidden rounded-2xl border border-border bg-elevated shadow-pop",
              wide ? "max-w-3xl" : "max-w-lg"
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h3 className="font-display font-bold text-fg">{title}</h3>
                <IconButton label="Close" onClick={onClose} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            )}
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <div className="flex justify-end gap-2 border-t border-border bg-surface/60 px-5 py-3.5">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({ open, onClose, title, children, footer, side = "right", width = "max-w-md" }) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const off = side === "right" ? "100%" : "-100%";
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgb(var(--shadow)/0.5)] backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: off }}
            animate={{ x: 0 }}
            exit={{ x: off }}
            transition={{ duration: 0.32, ease: EASE }}
            className={cx(
              "absolute inset-y-0 flex w-full flex-col border-border bg-elevated shadow-pop",
              width,
              side === "right" ? "right-0 border-l" : "left-0 border-r"
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="font-display font-bold text-fg">{title}</h3>
                <IconButton label="Close" onClick={onClose} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-border bg-surface/60 px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------------------------------------------------- */
/* Form controls                                                          */
/* --------------------------------------------------------------------- */
export function Field({ label, hint, error, required, htmlFor, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-danger"
          >
            <AlertTriangle className="h-3 w-3" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TextInput({ className = "", invalid = false, ...props }) {
  return <input {...props} className={cx("input", invalid && "border-danger/60 focus:ring-danger/15", className)} />;
}
export function Textarea({ className = "", ...props }) {
  return <textarea {...props} className={cx("input min-h-[110px] resize-y", className)} />;
}
export function Select({ options = [], className = "", ...props }) {
  return (
    <select {...props} className={cx("input pr-8", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, id, className = "" }) {
  const autoId = useId();
  const cid = id || autoId;
  return (
    <label
      htmlFor={cid}
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
        checked ? "border-primary/50 bg-primary/8" : "border-border bg-surface hover:border-border-strong",
        className
      )}
    >
      <span
        className={cx(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card"
        )}
      >
        <AnimatePresence>
          {checked && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <input id={cid} type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-fg">{label}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, id }) {
  const autoId = useId();
  const sid = id || autoId;
  return (
    <label htmlFor={sid} className="flex cursor-pointer items-center gap-3">
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-border-strong bg-elevated"
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cx("absolute top-0.5 rounded-full bg-white shadow", checked ? "left-[22px]" : "left-0.5")}
          style={{ height: 18, width: 18 }}
        />
      </button>
      {label && <span className="text-sm font-medium text-fg">{label}</span>}
    </label>
  );
}

/** Big card-style single-choice control for touch / kiosk use. */
export function RadioCards({ value, onChange, options, columns = 2, className = "" }) {
  return (
    <div className={cx("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2", className)}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <motion.button
            key={o.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(o.value)}
            aria-pressed={selected}
            className={cx(
              "flex min-h-[64px] items-center gap-3 rounded-2xl border p-4 text-left transition",
              selected
                ? "border-primary/60 bg-primary/8 shadow-[0_0_0_1px_rgb(var(--primary)/0.4)]"
                : "border-border bg-surface hover:border-border-strong hover:bg-elevated"
            )}
          >
            {o.icon && (
              <span
                className={cx(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                  selected ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-elevated text-fg-muted"
                )}
              >
                <o.icon className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-fg">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-xs text-fg-muted">{o.hint}</span>}
            </span>
            {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
          </motion.button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Tabs                                                                   */
/* --------------------------------------------------------------------- */
export function Tabs({ tabs, value, onChange, size = "md", className = "" }) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface/70 p-1 backdrop-blur",
        className
      )}
    >
      {tabs.map((t) => {
        const key = typeof t === "string" ? t : t.value;
        const label = typeof t === "string" ? t : t.label;
        const active = value === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cx(
              "relative z-10 rounded-lg font-semibold capitalize transition-colors",
              size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-1.5 text-sm",
              active ? "text-primary-foreground" : "text-fg-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-lg bg-primary-sheen shadow-[0_4px_14px_-4px_rgb(var(--primary)/0.55)]"
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Tooltip                                                                */
/* --------------------------------------------------------------------- */
export function Tooltip({ label, children, side = "top" }) {
  const [show, setShow] = useState(false);
  const child = Children.only(children);
  const pos =
    side === "bottom"
      ? "top-full mt-2"
      : side === "left"
      ? "right-full mr-2 top-1/2 -translate-y-1/2"
      : side === "right"
      ? "left-full ml-2 top-1/2 -translate-y-1/2"
      : "bottom-full mb-2";
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocusCapture={() => setShow(true)}
      onBlurCapture={() => setShow(false)}
    >
      {cloneElement(child, { "aria-label": child.props["aria-label"] || label })}
      <AnimatePresence>
        {show && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className={cx(
              "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-border bg-elevated px-2 py-1 text-xs font-medium text-fg shadow-pop",
              pos,
              side === "top" || side === "bottom" ? "left-1/2 -translate-x-1/2" : ""
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* --------------------------------------------------------------------- */
/* Sparkline + StatCard                                                   */
/* --------------------------------------------------------------------- */
export function Sparkline({ data = [], className = "", stroke = "rgb(var(--primary))" }) {
  const pts = data.length ? data : [3, 5, 4, 7, 6, 9, 8];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const w = 96;
  const h = 30;
  const step = w / Math.max(pts.length - 1, 1);
  const norm = (v) => h - 3 - ((v - min) / Math.max(max - min, 1)) * (h - 6);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${norm(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={stroke} opacity="0.12" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STAT_TONE = {
  primary: "text-primary bg-primary/10 border-primary/20",
  danger: "text-danger bg-danger/10 border-danger/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  success: "text-success bg-success/10 border-success/20",
  accent: "text-accent bg-accent/10 border-accent/20",
};

export function StatCard({
  label,
  value,
  numeric,
  decimals = 0,
  suffix = "",
  sub,
  trend,
  spark,
  icon: Icon,
  tone = "primary",
  loading = false,
}) {
  return (
    <Card hover className="relative overflow-hidden p-4">
      <div
        className={cx(
          "pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl opacity-[0.14]",
          STAT_TONE[tone]?.split(" ")[1]
        )}
      />
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {Icon && (
          <span className={cx("grid h-8 w-8 place-items-center rounded-lg border", STAT_TONE[tone] || STAT_TONE.primary)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-2">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p className="font-display text-2xl font-extrabold tracking-tight text-fg">
            {numeric != null ? (
              <AnimatedNumber value={numeric} decimals={decimals} suffix={suffix} />
            ) : (
              value ?? "—"
            )}
          </p>
        )}
        {trend != null && trend !== 0 && (
          <span
            className={cx(
              "mb-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
              trend > 0 ? "bg-success/12 text-success" : "bg-danger/12 text-danger"
            )}
          >
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        {sub && <p className="text-xs text-fg-subtle">{sub}</p>}
        {spark && <Sparkline data={spark} className="ml-auto" />}
      </div>
    </Card>
  );
}
