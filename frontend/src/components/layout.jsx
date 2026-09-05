import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Stethoscope,
  Users,
} from "lucide-react";
import { useState } from "react";
import { LANGUAGES, useI18n } from "../lib/i18n";

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-card">
        <HeartPulse className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight text-clinical-ink">MACI</span>
          <span className="block text-[11px] font-medium text-clinical-muted">Clinical Intake Platform</span>
        </span>
      )}
    </Link>
  );
}

export function LanguagePicker({ value, onChange, className = "" }) {
  return (
    <div className={`inline-flex rounded-xl border border-clinical-line bg-white p-0.5 ${className}`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            value === l.code ? "bg-brand-600 text-white" : "text-clinical-muted hover:text-clinical-ink"
          }`}
          aria-pressed={value === l.code}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}

export function PublicNav() {
  const { lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-clinical-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-2">
          <LanguagePicker value={lang} onChange={setLang} className="mr-1 hidden sm:inline-flex" />
          <NavLink to="/intake" className="btn-outline px-3.5 py-2 text-sm">
            <Stethoscope className="h-4 w-4" /> Start Intake
          </NavLink>
          <NavLink to="/doctor" className="btn-primary px-3.5 py-2 text-sm">
            <LayoutDashboard className="h-4 w-4" /> Doctor
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

const DOCTOR_NAV = [
  { to: "/doctor", label: "Queue", icon: Users, end: true },
  { to: "/doctor?tab=analytics", label: "Analytics", icon: BarChart3 },
];

export function DoctorShell({ children, right }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-clinical-bg lg:grid lg:grid-cols-[248px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-clinical-line bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center border-b border-clinical-line px-4">
          <Logo />
        </div>
        <nav className="space-y-1 p-3">
          {DOCTOR_NAV.map((item) => {
            const active = item.end
              ? loc.pathname === "/doctor" && !loc.search.includes("analytics")
              : loc.search.includes("analytics");
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-clinical-muted hover:bg-clinical-bg hover:text-clinical-ink"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/intake"
            className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-clinical-muted hover:bg-clinical-bg hover:text-clinical-ink"
          >
            <Activity className="h-4 w-4" />
            Patient Kiosk
          </Link>
        </nav>
        <div className="absolute bottom-0 w-full border-t border-clinical-line p-3 text-[11px] leading-relaxed text-clinical-muted">
          Prototype · not for clinical use. AI drafts require clinician review.
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-clinical-ink/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between border-b border-clinical-line bg-white px-4 lg:px-6">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold text-clinical-ink">
            <Stethoscope className="h-4 w-4 text-brand-600" />
            Doctor Dashboard
          </div>
          <div className="flex items-center gap-2">{right}</div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-clinical-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-clinical-muted">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <Logo />
          <p className="max-w-xl text-xs leading-relaxed">
            MACI is a prototype. It assists history collection and drafts a summary for a clinician — it does
            not diagnose. Not certified for HIPAA / India DPDP / ABDM. Production use requires a formal
            security &amp; compliance review.
          </p>
        </div>
      </div>
    </footer>
  );
}
