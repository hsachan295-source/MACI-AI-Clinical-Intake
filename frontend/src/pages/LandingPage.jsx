import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { PublicFooter, TopNav } from "../components/layout.jsx";
import { Badge, Card, cx } from "../components/ui.jsx";
import { fadeUp, listItem, staggerParent } from "../lib/motion.jsx";
import { FEATURES, WORKFLOW } from "../lib/constants";
import { useI18n } from "../lib/i18n";

function HeroPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      className="relative mx-auto mt-14 w-full max-w-3xl [perspective:1200px]"
    >
      <div className="glass-strong overflow-hidden rounded-3xl p-1.5 shadow-pop">
        <div className="rounded-[1.35rem] border border-border/60 bg-surface/80 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <BrainCircuit className="h-4 w-4 text-primary" /> Live Clinical Intelligence
            </div>
            <Badge tone="success">Interview 82%</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Chief complaint", "Chest discomfort on exertion, 3 days"],
              ["Onset / duration", "Gradual · 3 days · intermittent"],
              ["Associated", "Mild exertional dyspnoea"],
              ["Priority", "Urgent — cardiac risk factors"],
            ].map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.5 }}
                className="rounded-xl border border-border bg-card/70 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{k}</p>
                <p className="mt-0.5 text-sm text-fg">{v}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-xs font-semibold text-critical">
            <ShieldCheck className="h-4 w-4" /> Red-flag screen active on every message
          </div>
        </div>
      </div>
      <div className="orb absolute -right-10 -top-10 h-40 w-40" style={{ background: "rgb(var(--primary) / 0.4)" }} />
    </motion.div>
  );
}

function WorkflowRail() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">How MACI works</p>
        <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight text-fg text-balance">
          Seven steps from waiting room to informed consult
        </h2>
      </motion.div>

      <motion.ol
        variants={staggerParent(0.12)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="relative mt-12 grid gap-4 md:grid-cols-4 lg:grid-cols-7"
      >
        <span className="pointer-events-none absolute left-6 top-6 hidden h-[calc(100%-3rem)] w-px bg-gradient-to-b from-primary/50 via-border to-transparent md:hidden" />
        {WORKFLOW.map((node, i) => (
          <motion.li key={node.key} variants={listItem} className="relative">
            <Card className="h-full p-4 card-hover">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <node.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[13px] font-bold text-fg">{node.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">{node.note}</p>
              <span className="absolute right-3 top-3 text-[11px] font-bold text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
            </Card>
            {i < WORKFLOW.length - 1 && (
              <ChevronRight className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-border-strong lg:block" />
            )}
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}

export default function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen px-3">
      <TopNav />

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-1 pb-10 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary backdrop-blur"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            History-collection assistant — not a diagnostic tool
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-6xl"
          >
            MACI
            <span className="mt-3 block bg-primary-sheen bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
              Multilingual AI Clinical Intake Platform
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted text-balance"
          >
            {t("app.tagline")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link to="/intake" className="btn-primary group h-12 px-6 text-[15px]">
              <Stethoscope className="h-5 w-5" />
              Start Patient Intake
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link to="/doctor" className="btn-outline h-12 px-6 text-[15px]">
              <Sparkles className="h-5 w-5 text-primary" />
              Open Doctor Dashboard
            </Link>
          </motion.div>
        </div>

        <HeroPanel />
      </section>

      <WorkflowRail />

      {/* Feature showcase */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">Capabilities</p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight text-fg text-balance">
            Everything the doctor needs, before the consultation
          </h2>
        </motion.div>

        <motion.div
          variants={staggerParent(0.05)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={listItem}>
              <Card glass hover className="group h-full overflow-hidden p-5">
                <div className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-primary-sheen opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-15" />
                <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="relative mt-4 font-display font-bold text-fg">{f.title}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-fg-muted">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Safety band */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 rounded-3xl border border-border bg-card/70 p-6 backdrop-blur-xl sm:grid-cols-[1.5fr_1fr] sm:p-8"
        >
          <div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold text-fg">Safety-first by design</h3>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-fg-muted">
              {[
                "A deterministic rule-based red-flag layer runs on every message — independent of the LLM.",
                "Structured AI output is validated with Pydantic; malformed JSON is repaired or safely rejected.",
                "Strict per-patient isolation on every semantic retrieval.",
                "Consent is recorded before any intake begins.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className={cx("rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-fg")}>
            <p className="font-bold text-warning">This is a prototype.</p>
            <p className="mt-1.5 leading-relaxed text-fg-muted">
              It does not provide a diagnosis and is not certified for HIPAA, India DPDP or ABDM. A formal security
              &amp; compliance review is required before production deployment.
            </p>
          </div>
        </motion.div>
      </section>

      <PublicFooter />
    </div>
  );
}
