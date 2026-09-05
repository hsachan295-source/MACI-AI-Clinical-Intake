import { useCallback, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { I18nContext, translate } from "./lib/i18n";
import LandingPage from "./pages/LandingPage.jsx";
import PatientIntakePage from "./pages/PatientIntakePage.jsx";
import DoctorDashboardPage from "./pages/DoctorDashboardPage.jsx";
import DoctorPatientPage from "./pages/DoctorPatientPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

const LANG_KEY = "maci.lang";

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

  const i18n = useMemo(
    () => ({ lang, setLang, t: (key) => translate(lang, key) }),
    [lang, setLang]
  );

  return (
    <I18nContext.Provider value={i18n}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/intake" element={<PatientIntakePage />} />
        <Route path="/doctor" element={<DoctorDashboardPage />} />
        <Route path="/doctor/patients/:patientId" element={<DoctorPatientPage />} />
        <Route path="/doctor/queue" element={<Navigate to="/doctor" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </I18nContext.Provider>
  );
}
