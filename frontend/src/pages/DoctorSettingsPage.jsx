import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Accessibility,
  Bell,
  CircleCheck,
  CircleSlash,
  Contrast,
  Gauge,
  Info,
  Languages,
  Palette,
  RotateCcw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Type,
  Zap,
} from "lucide-react";
import { DoctorShell, LanguagePicker } from "../components/layout.jsx";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  PriorityBadge,
  RadioCards,
  Select,
  Spinner,
  Switch,
  cx,
} from "../components/ui.jsx";
import { ThemeSelector, useTheme } from "../lib/theme.jsx";
import { usePreferences } from "../lib/preferences.jsx";
import { useI18n } from "../lib/i18n";
import { staggerParent, listItem } from "../lib/motion.jsx";
import { api } from "../lib/api";

const APP_VERSION = "0.1.0";
const APP_NAME = import.meta.env.VITE_APP_NAME || "MACI";

function Section({ icon: Icon, title, desc, children }) {
  return (
    <motion.section variants={listItem}>
      <Card className="p-5">
        <header className="mb-1 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-elevated text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="font-display font-bold text-fg">{title}</h2>
        </header>
        {desc && <p className="text-xs text-fg-muted">{desc}</p>}
        <div className="mt-2 divide-y divide-border">{children}</div>
      </Card>
    </motion.section>
  );
}

function Row({ title, desc, children, stack }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 py-4 first:pt-3 last:pb-1",
        !stack && "sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-fg-muted">{desc}</p>}
      </div>
      <div className={cx("shrink-0", stack ? "" : "sm:pl-6")}>{children}</div>
    </div>
  );
}

function ThemePreview() {
  const { resolved } = useTheme();
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
          Preview · {resolved}
        </span>
        <div className="flex gap-1">
          {["bg-surface", "bg-elevated", "bg-primary", "bg-success", "bg-danger"].map((c) => (
            <span key={c} className={cx("h-4 w-4 rounded-full border border-border", c)} />
          ))}
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-border bg-card p-3">
        <p className="text-sm font-semibold text-fg">Card surface</p>
        <p className="text-xs text-fg-muted">Secondary text on the card.</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="btn-primary h-7 px-3 text-xs">Primary</span>
          <Badge tone="success">Active</Badge>
          <Badge tone="critical">Red flag</Badge>
        </div>
      </div>
    </div>
  );
}

const PRIORITY_DISPLAY = [
  { value: "badge", label: "Badge (dot + label)" },
  { value: "dot", label: "Dot only" },
  { value: "text", label: "Text label only" },
];
const INTERVALS = [
  { value: "10", label: "Every 10s" },
  { value: "15", label: "Every 15s" },
  { value: "30", label: "Every 30s" },
  { value: "60", label: "Every 60s" },
];
const DASH_TABS = [
  { value: "queue", label: "Patient Queue" },
  { value: "analytics", label: "Analytics" },
];

export default function DoctorSettingsPage() {
  const { lang, setLang } = useI18n();
  const { prefs, setPref, resetPrefs } = usePreferences();

  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await (api.healthDetails ? api.healthDetails() : api.health());
        if (alive) setHealth(d);
      } catch {
        if (alive) setHealthErr(true);
      } finally {
        if (alive) setHealthLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const integrations = health?.integrations || {};

  return (
    <DoctorShell title="Settings">
      <PageHeader
        icon={SlidersHorizontal}
        title="Settings"
        subtitle="Appearance, workflow and accessibility preferences. Stored on this device only."
        actions={
          <Button variant="outline" size="sm" onClick={resetPrefs}>
            <RotateCcw className="h-4 w-4" /> Reset defaults
          </Button>
        }
      />

      <motion.div
        variants={staggerParent(0.06)}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-2"
      >
        {/* Appearance */}
        <Section icon={Palette} title="Appearance" desc="Light, dark, or follow your operating system.">
          <Row title="Theme" desc="Applies across the whole application.">
            <ThemeSelector />
          </Row>
          <Row title="Theme preview" stack>
            <ThemePreview />
          </Row>
        </Section>

        {/* Language */}
        <Section icon={Languages} title="Language" desc="Interface language for the patient kiosk.">
          <Row title="Language" desc="English or हिन्दी. More Indian languages planned.">
            <LanguagePicker value={lang} onChange={setLang} />
          </Row>
        </Section>

        {/* Clinical preferences */}
        <Section icon={Gauge} title="Clinical preferences">
          <Row title="Default intake mode" desc="How the patient kiosk starts a new intake." stack>
            <RadioCards
              value={prefs.intakeMode}
              onChange={(v) => setPref("intakeMode", v)}
              options={[
                { value: "text", label: "Touch / Text" },
                { value: "voice", label: "Voice" },
              ]}
            />
          </Row>
          <Row title="Show reviewed patients" desc="Include already-reviewed patients in the queue by default.">
            <Switch checked={prefs.showReviewed} onChange={(v) => setPref("showReviewed", v)} />
          </Row>
          <Row title="Priority display" desc="How triage priority is rendered in lists.">
            <div className="flex items-center gap-2">
              <Select
                value={prefs.priorityDisplay}
                onChange={(e) => setPref("priorityDisplay", e.target.value)}
                options={PRIORITY_DISPLAY}
                className="h-9 w-auto py-1 text-sm"
              />
              <PriorityBadge priority="urgent" />
            </div>
          </Row>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          <Row title="High-priority alert" desc="Toast when an emergency / red-flag patient is in the queue.">
            <Switch checked={prefs.notifyHighPriority} onChange={(v) => setPref("notifyHighPriority", v)} />
          </Row>
          <Row title="Intake completion" desc="Toast when a patient submits a completed intake.">
            <Switch checked={prefs.notifyIntakeComplete} onChange={(v) => setPref("notifyIntakeComplete", v)} />
          </Row>
        </Section>

        {/* Dashboard preferences */}
        <Section icon={Zap} title="Dashboard preferences">
          <Row title="Auto-refresh" desc="Keep the queue and analytics up to date automatically.">
            <Switch checked={prefs.autoRefresh} onChange={(v) => setPref("autoRefresh", v)} />
          </Row>
          {prefs.autoRefresh && (
            <Row title="Refresh interval">
              <Select
                value={String(prefs.refreshInterval)}
                onChange={(e) => setPref("refreshInterval", Number(e.target.value))}
                options={INTERVALS}
                className="h-9 w-auto py-1 text-sm"
              />
            </Row>
          )}
          <Row title="Density" desc="Comfortable spacing, or compact to fit more on screen." stack>
            <RadioCards
              value={prefs.density}
              onChange={(v) => setPref("density", v)}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </Row>
          <Row title="Default dashboard tab" desc="Which view opens first.">
            <Select
              value={prefs.defaultTab}
              onChange={(e) => setPref("defaultTab", e.target.value)}
              options={DASH_TABS}
              className="h-9 w-auto py-1 text-sm"
            />
          </Row>
        </Section>

        {/* Accessibility */}
        <Section icon={Accessibility} title="Accessibility">
          <Row title="Reduced motion" desc="Minimise animations and transitions (also follows your OS setting).">
            <Switch checked={prefs.reduceMotion} onChange={(v) => setPref("reduceMotion", v)} />
          </Row>
          <Row title="Larger text" desc="Increase the base font size across the app.">
            <span className="flex items-center gap-2">
              <Type className="h-4 w-4 text-fg-subtle" />
              <Switch checked={prefs.largeText} onChange={(v) => setPref("largeText", v)} />
            </span>
          </Row>
          <Row title="High contrast" desc="Stronger borders and text for better legibility.">
            <span className="flex items-center gap-2">
              <Contrast className="h-4 w-4 text-fg-subtle" />
              <Switch checked={prefs.highContrast} onChange={(v) => setPref("highContrast", v)} />
            </span>
          </Row>
        </Section>

        {/* About */}
        <motion.section variants={listItem} className="lg:col-span-2">
          <Card className="p-5">
            <header className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-elevated text-primary">
                <Info className="h-4 w-4" />
              </span>
              <h2 className="font-display font-bold text-fg">About</h2>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Application</dt>
                  <dd className="font-medium text-fg">{APP_NAME} — Multilingual AI Clinical Intake Platform</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Version</dt>
                  <dd className="font-mono text-fg">v{APP_VERSION}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-fg-muted">
                    <Server className="h-3.5 w-3.5" /> Backend
                  </dt>
                  <dd>
                    {healthLoading ? (
                      <Spinner label="Checking…" />
                    ) : healthErr ? (
                      <Badge tone="danger">Unreachable</Badge>
                    ) : (
                      <span className="flex flex-wrap items-center justify-end gap-1.5">
                        <Badge tone="success">Online</Badge>
                        {health?.runtime?.repository && <Badge tone="neutral">DB: {health.runtime.repository}</Badge>}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div>
                {!healthLoading && !healthErr && Object.keys(integrations).length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(integrations).map(([k, on]) => (
                      <span
                        key={k}
                        className={cx(
                          "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
                          on ? "border-success/25 bg-success/10 text-fg" : "border-border bg-surface/60 text-fg-muted"
                        )}
                      >
                        <span className="capitalize">{k.replace("_", " ")}</span>
                        {on ? <CircleCheck className="h-3.5 w-3.5 text-success" /> : <CircleSlash className="h-3.5 w-3.5 text-fg-subtle" />}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/8 px-3 py-2.5 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-fg-muted">
                <span className="font-semibold text-warning">AI-generated drafts require clinician review.</span> MACI
                assists history collection and does not diagnose. Not certified for HIPAA / India DPDP / ABDM.
              </p>
            </div>
          </Card>
        </motion.section>
      </motion.div>
    </DoctorShell>
  );
}
