import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/intake" element={<PatientIntakePage />} />
            <Route path="/doctor" element={<DoctorDashboardPage />} />
            <Route path="/doctor/patients/:patientId" element={<DoctorPatientPage />} />
            <Route path="/doctor/settings" element={<DoctorSettingsPage />} />
            <Route path="/doctor/queue" element={<Navigate to="/doctor" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
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
