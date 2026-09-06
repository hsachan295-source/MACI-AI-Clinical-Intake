import { Component, Suspense, lazy, useCallback, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { I18nContext, translate } from "./lib/i18n";
import { pageVariants } from "./lib/motion.jsx";
import { Spinner } from "./components/ui.jsx";
import { AppBackground } from "./components/layout.jsx";

const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const PatientIntakePage = lazy(() => import("./pages/PatientIntakePage.jsx"));
const DoctorDashboardPage = lazy(() => import("./pages/DoctorDashboardPage.jsx"));
const DoctorPatientPage = lazy(() => import("./pages/DoctorPatientPage.jsx"));
const DoctorSettingsPage = lazy(() => import("./pages/DoctorSettingsPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

const LANG_KEY = "maci.lang";

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner label="Loading MACI…" />
    </div>
  );
}

/**
 * Catches render/lazy-chunk errors so a crash (or a stale-chunk 404 after a
 * deploy) shows a recoverable message instead of a blank white page.
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(prev) {
    if (prev.routeKey !== this.props.routeKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error || "Unknown error");
    const chunkErr = /dynamically imported module|Failed to fetch|Importing a module script failed|ChunkLoadError/i.test(msg);
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-danger/8 p-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
            <TriangleAlert className="h-6 w-6" />
          </span>
          <p className="font-display font-bold text-fg">This page failed to load</p>
          <p className="mt-1.5 text-sm text-fg-muted">
            {chunkErr
              ? "A newer version of MACI was deployed. Reload to get the latest."
              : "An unexpected error occurred while rendering this page."}
          </p>
          <button className="btn-primary mx-auto mt-4 h-10 px-4" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Reload
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface/60 p-2 text-left text-[11px] text-fg-subtle">
              {msg}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <RouteErrorBoundary routeKey={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/intake" element={<PatientIntakePage />} />
              <Route path="/doctor" element={<DoctorDashboardPage />} />
              <Route path="/doctor/patients/:patientId" element={<DoctorPatientPage />} />
              <Route path="/doctor/settings" element={<DoctorSettingsPage />} />
              <Route path="/doctor/analytics" element={<Navigate to="/doctor?tab=analytics" replace />} />
              <Route path="/doctor/queue" element={<Navigate to="/doctor" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(LANG_KEY) || "en";
    } catch {
      return "en";
    }
  });

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const i18n = useMemo(() => ({ lang, setLang, t: (key) => translate(lang, key) }), [lang, setLang]);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="relative min-h-screen">
        <AppBackground />
        <div className="relative z-10">
          <AnimatedRoutes />
        </div>
      </div>
    </I18nContext.Provider>
  );
}
