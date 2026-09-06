import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Monitor, Moon, Sun } from "lucide-react";

const STORAGE_KEY = "maci-theme";
export const THEME_MODES = ["light", "dark", "system"];

const mql = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return THEME_MODES.includes(v) ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(mode) {
  if (mode === "system") return mql()?.matches ? "dark" : "light";
  return mode;
}

function applyResolved(resolved) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  window.clearTimeout(applyResolved._t);
  applyResolved._t = window.setTimeout(() => root.classList.remove("theme-transition"), 360);
}

const ThemeContext = createContext({
  mode: "system",
  resolved: "light",
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readStored);
  const [resolved, setResolved] = useState(() => resolve(readStored()));
  const firstRun = useRef(true);

  // Keep the DOM in sync with `mode`.
  useLayoutEffect(() => {
    const next = resolve(mode);
    setResolved(next);
    if (firstRun.current) {
      // index.html already painted the right theme — don't run the transition.
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      firstRun.current = false;
    } else {
      applyResolved(next);
    }
  }, [mode]);

  // Live-follow the OS when in System mode.
  useEffect(() => {
    const m = mql();
    if (!m) return undefined;
    const onChange = () => {
      if (readStored() === "system") {
        const next = m.matches ? "dark" : "light";
        setResolved(next);
        applyResolved(next);
      }
    };
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, []);

  // Sync across tabs.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setModeState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next) => {
    if (!THEME_MODES.includes(next)) return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Desktop: animated segmented control. Mobile: compact popover. */
export function ThemeSelector({ variant = "auto", className = "" }) {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  const pillId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = OPTIONS.find((o) => o.value === mode) || OPTIONS[2];

  if (variant === "compact") {
    return (
      <div ref={popRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Theme: ${active.label}. Change theme`}
          className="btn-outline h-9 w-9 rounded-xl p-0"
        >
          <active.icon className="h-[18px] w-[18px]" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-elevated p-1.5 shadow-pop"
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Appearance
              </p>
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  role="menuitemradio"
                  aria-checked={mode === o.value}
                  onClick={() => {
                    setMode(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                    mode === o.value ? "bg-primary/10 text-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg"
                  }`}
                >
                  <o.icon className="h-4 w-4" />
                  {o.label}
                  {mode === o.value && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Segmented control
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`relative inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface/70 p-1 backdrop-blur ${className}`}
    >
      {OPTIONS.map((o) => {
        const selected = mode === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            title={`${o.label} theme`}
            onClick={() => setMode(o.value)}
            className="relative z-10 grid h-8 w-9 place-items-center rounded-lg transition-colors"
          >
            {selected && (
              <motion.span
                layoutId={`theme-pill-${pillId}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-primary-sheen shadow-[0_4px_14px_-4px_rgb(var(--primary)/0.6)]"
              />
            )}
            <o.icon
              className={`relative h-[17px] w-[17px] transition-colors ${
                selected ? "text-primary-foreground" : "text-fg-subtle"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
