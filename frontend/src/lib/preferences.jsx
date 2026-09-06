import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";

const KEY = "maci-prefs";

export const DEFAULT_PREFS = {
  // Clinical
  intakeMode: "text", // "text" | "voice"
  showReviewed: false,
  priorityDisplay: "badge", // "badge" | "dot" | "text"
  // Notifications
  notifyHighPriority: true,
  notifyIntakeComplete: false,
  // Dashboard
  autoRefresh: true,
  refreshInterval: 15, // seconds
  density: "comfortable", // "comfortable" | "compact"
  defaultTab: "queue", // "queue" | "analytics"
  // Accessibility
  reduceMotion: false,
  largeText: false,
  highContrast: false,
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULT_PREFS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const PrefsContext = createContext({
  prefs: DEFAULT_PREFS,
  setPref: () => {},
  resetPrefs: () => {},
});

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  // Apply the visual / accessibility preferences to <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = prefs.density;
    root.classList.toggle("a11y-large-text", !!prefs.largeText);
    root.classList.toggle("a11y-high-contrast", !!prefs.highContrast);
    root.dataset.reduceMotion = prefs.reduceMotion ? "1" : "0";
  }, [prefs.density, prefs.largeText, prefs.highContrast, prefs.reduceMotion]);

  // Sync across tabs.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setPrefs(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPref = useMemo(
    () => (key, value) => setPrefs((p) => ({ ...p, [key]: value })),
    []
  );
  const resetPrefs = useMemo(() => () => setPrefs({ ...DEFAULT_PREFS }), []);

  const value = useMemo(() => ({ prefs, setPref, resetPrefs }), [prefs, setPref, resetPrefs]);

  return (
    <PrefsContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>{children}</MotionConfig>
    </PrefsContext.Provider>
  );
}

/** Safe outside a provider — returns defaults. */
export function usePreferences() {
  return useContext(PrefsContext);
}
