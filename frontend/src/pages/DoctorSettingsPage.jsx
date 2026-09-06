import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CircleCheck, CircleSlash, Globe, Palette, Server, ShieldAlert } from "lucide-react";
import { DoctorShell } from "../components/layout.jsx";
import { Badge, Card, PageHeader, Spinner, cx } from "../components/ui.jsx";
import { ThemeSelector } from "../lib/theme.jsx";
import { LanguagePicker } from "../components/layout.jsx";
import { useI18n } from "../lib/i18n";
import { staggerParent, listItem } from "../lib/motion.jsx";
import { api } from "../lib/api";

function SettingRow({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-elevated text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">{title}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{desc}</p>
        </div>
      </div>
      <div className="sm:pl-4">{children}</div>
    </div>
  );
}

export default function DoctorSettingsPage() {
  const { lang, setLang } = useI18n();
  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.healthDetails();
        if (alive) setHealth(d);
      } catch {
        if (alive) setHealthErr(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const integrations = health?.integrations || {};

  return (
    <DoctorShell title="Settings">
      <PageHeader icon={Activity} title="Settings" subtitle="Appearance, language and backend status." />

      <motion.div variants={staggerParent(0.08)} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={listItem}>
          <Card className="p-5">
            <h2 className="mb-1 font-display font-bold text-fg">Appearance &amp; language</h2>
            <p className="text-xs text-fg-muted">Stored on this device.</p>
            <div className="mt-1">
              <SettingRow icon={Palette} title="Theme" desc="Light, dark or follow your operating system.">
                <ThemeSelector />
              </SettingRow>
              <SettingRow icon={Globe} title="Language" desc="Interface language for the patient kiosk.">
                <LanguagePicker value={lang} onChange={setLang} />
              </SettingRow>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={listItem}>
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display font-bold text-fg">
              <Server className="h-4 w-4 text-primary" /> Backend status
            </h2>
            <p className="text-xs text-fg-muted">Live from the MACI API — booleans only, no keys.</p>
            <div className="mt-4">
              {loading ? (
                <Spinner label="Checking…" />
              ) : healthErr ? (
                <Badge tone="danger">API unreachable</Badge>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone="success">API online</Badge>
                    {health?.serverless && <Badge tone="neutral">Serverless</Badge>}
                    {health?.runtime?.repository && (
                      <Badge tone="neutral">DB: {health.runtime.repository}</Badge>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(integrations).map(([k, on]) => (
                      <div
                        key={k}
                        className={cx(
                          "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
                          on ? "border-success/25 bg-success/8" : "border-border bg-surface/60"
                        )}
                      >
                        <span className="font-medium capitalize text-fg">{k.replace("_", " ")}</span>
                        {on ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-success">
                            <CircleCheck className="h-4 w-4" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-fg-subtle">
                            <CircleSlash className="h-4 w-4" /> Fallback
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={listItem} className="lg:col-span-2">
          <Card className="border-warning/30 bg-warning/8 p-5">
            <p className="flex items-center gap-2 font-display font-bold text-warning">
              <ShieldAlert className="h-4 w-4" /> Prototype notice
            </p>
            <p className="mt-1.5 text-sm text-fg-muted">
              MACI assists clinical history collection and drafts a summary for a clinician — it does not diagnose. Not
              certified for HIPAA / India DPDP / ABDM. AI-generated content always requires clinician review.
            </p>
          </Card>
        </motion.div>
      </motion.div>
    </DoctorShell>
  );
}
