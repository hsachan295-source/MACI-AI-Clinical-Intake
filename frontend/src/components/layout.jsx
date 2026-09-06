import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Stethoscope,
  X,
} from "lucide-react";
import { LANGUAGES, useI18n } from "../lib/i18n";
import { ThemeSelector } from "../lib/theme.jsx";
import { cx } from "./ui.jsx";

/* --------------------------------------------------------------------- */
/* Ambient background — aurora orbs + subtle grid                         */
/* --------------------------------------------------------------------- */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="grid-bg opacity-70" />
      <div
        className="orb h-[42rem] w-[42rem] animate-orb-drift"
        style={{ top: "-16rem", left: "-10rem", background: "rgb(var(--orb-1) / 0.45)" }}
      />
      <div
        className="orb h-[34rem] w-[34rem] animate-orb-drift"
        style={{ top: "8rem", right: "-14rem", background: "rgb(var(--orb-2) / 0.40)", animationDelay: "-6s" }}
      />
      <div
        className="orb h-[30rem] w-[30rem] animate-orb-drift"
        style={{ bottom: "-14rem", left: "20%", background: "rgb(var(--orb-3) / 0.35)", animationDelay: "-11s" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/40 to-bg" />
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Logo                                                                   */
/* --------------------------------------------------------------------- */
export function Logo({ compact = false, className = "" }) {
  return (
    <Link to="/" className={cx("group flex items-center gap-2.5", className)}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary-sheen text-white shadow-[0_6px_20px_-6px_rgb(var(--primary)/0.7)]">
        <Stethoscope className="h-[18px] w-[18px]" />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-extrabold tracking-tight text-fg">MACI</span>
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Clinical Intake
          </span>
        </span>
      )}
    </Link>
  );
}

/* --------------------------------------------------------------------- */
/* Language picker                                                        */
/* --------------------------------------------------------------------- */
export function LanguagePicker({ value, onChange, className = "" }) {
  const pillId = useId();
  return (
    <div className={cx("inline-flex items-center rounded-xl border border-border bg-surface/70 p-1 backdrop-blur", className)}>
      {LANGUAGES.map((l) => {
        const on = value === l.code;
        return (
          <button
            key={l.code}
            onClick={() => onChange(l.code)}
            aria-pressed={on}
            className={cx(
              "relative z-10 rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-colors",
              on ? "text-primary-foreground" : "text-fg-subtle hover:text-fg"
            )}
          >
            {on && (
              <motion.span
                layoutId={`lang-pill-${pillId}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-lg bg-primary-sheen"
              />
            )}
            {l.native}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Public / landing navbar                                               */
/* --------------------------------------------------------------------- */
export function TopNav() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cx(
          "mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-all duration-300 sm:px-4",
          scrolled
            ? "border border-border bg-card/80 shadow-card backdrop-blur-xl"
            : "border border-transparent bg-transparent"
        )}
        style={{ marginLeft: "max(0.75rem, env(safe-area-inset-left))", marginRight: "max(0.75rem, env(safe-area-inset-right))" }}
      >
        <Logo />

        <nav className="hidden items-center gap-2 md:flex">
          <LanguagePicker value={lang} onChange={setLang} />
          <ThemeSelector />
          <NavLink to="/intake" className="btn-outline h-9 px-3.5 text-sm">
            <Stethoscope className="h-4 w-4" /> Start Intake
          </NavLink>
          <NavLink to="/doctor" className="btn-primary h-9 px-3.5 text-sm">
            <LayoutGrid className="h-4 w-4" /> Doctor
          </NavLink>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeSelector variant="compact" />
          <button
            className="btn-outline h-9 w-9 rounded-xl p-0"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-[rgb(var(--shadow)/0.5)] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 right-0 flex w-72 flex-col gap-4 border-l border-border bg-elevated p-5"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button className="btn-ghost h-9 w-9 rounded-xl p-0" onClick={() => setOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLink to="/intake" onClick={() => setOpen(false)} className="btn-outline h-11 justify-start px-4">
                <Stethoscope className="h-4 w-4" /> Start Patient Intake
              </NavLink>
              <NavLink to="/doctor" onClick={() => setOpen(false)} className="btn-primary h-11 justify-start px-4">
                <LayoutGrid className="h-4 w-4" /> Doctor Dashboard
              </NavLink>
              <div className="mt-auto space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Language</p>
                <LanguagePicker value={lang} onChange={setLang} className="w-full justify-between" />
                <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Appearance</p>
                <ThemeSelector />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* --------------------------------------------------------------------- */
/* Doctor shell — collapsible sidebar + top bar                          */
/* --------------------------------------------------------------------- */
const DOCTOR_NAV = [
  { to: "/doctor", label: "Overview", icon: LayoutGrid, match: (l) => l.pathname === "/doctor" && !l.search.includes("analytics") },
  { to: "/doctor?tab=analytics", label: "Analytics", icon: BarChart3, match: (l) => l.search.includes("analytics") },
  { to: "/doctor/settings", label: "Settings", icon: Settings, match: (l) => l.pathname === "/doctor/settings" },
];

export function DoctorShell({ children, right, title = "Doctor Dashboard" }) {
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("maci-sidebar") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("maci-sidebar", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  useEffect(() => setMobileOpen(false), [loc.pathname, loc.search]);

  const NavList = ({ onNavigate }) => (
    <nav className="flex-1 space-y-1 p-3">
      {DOCTOR_NAV.map((item) => {
        const active = item.match(loc);
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              collapsed && "lg:justify-center lg:px-0",
              active
                ? "bg-primary/12 text-primary shadow-inset"
                : "text-fg-muted hover:bg-fg/5 hover:text-fg"
            )}
          >
            <item.icon className={cx("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
            <span className={cx(collapsed && "lg:hidden")}>{item.label}</span>
            {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
        );
      })}
      <div className="my-2 border-t border-border" />
      <Link
        to="/intake"
        onClick={onNavigate}
        title={collapsed ? "Patient Kiosk" : undefined}
        className={cx(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-muted transition hover:bg-fg/5 hover:text-fg",
          collapsed && "lg:justify-center lg:px-0"
        )}
      >
        <Activity className="h-[18px] w-[18px] shrink-0" />
        <span className={cx(collapsed && "lg:hidden")}>Patient Kiosk</span>
      </Link>
    </nav>
  );

  return (
    <div
      className={cx(
        "min-h-screen transition-[grid-template-columns] duration-300 lg:grid",
        collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[240px_1fr]"
      )}
    >
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-card/70 backdrop-blur-xl lg:flex">
        <div className={cx("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-0")}>
          <Logo compact={collapsed} />
        </div>
        <NavList />
        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-fg-subtle transition hover:bg-fg/5 hover:text-fg"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className={cx(collapsed && "hidden")}>Collapse</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-[rgb(var(--shadow)/0.5)] backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-elevated"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <Logo />
                <button className="btn-ghost h-8 w-8 rounded-xl p-0" onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/70 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="btn-outline h-9 w-9 rounded-xl p-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 font-display text-[15px] font-bold text-fg">
              <Stethoscope className="hidden h-4 w-4 text-primary sm:block" />
              {title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {right}
            <ThemeSelector className="hidden sm:inline-flex" />
            <ThemeSelector variant="compact" className="sm:hidden" />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Public footer                                                          */
/* --------------------------------------------------------------------- */
export function PublicFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Logo />
          <p className="max-w-xl text-xs leading-relaxed text-fg-subtle">
            MACI is a prototype. It assists history collection and drafts a summary for a clinician — it does not
            diagnose. Not certified for HIPAA / India DPDP / ABDM. Production use requires a formal security &amp;
            compliance review.
          </p>
        </div>
      </div>
    </footer>
  );
}
