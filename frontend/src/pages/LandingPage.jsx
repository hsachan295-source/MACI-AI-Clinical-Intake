import { Link } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  CalendarClock,
  FileScan,
  LayoutDashboard,
  Mic,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { PublicFooter, PublicNav } from "../components/layout.jsx";
import { useI18n } from "../lib/i18n";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Clinical History",
    body: "An assistant asks adaptive follow-up questions using frameworks like SOCRATES, then returns a validated, structured history — never a diagnosis.",
  },
  {
    icon: Mic,
    title: "Multilingual Voice Intake",
    body: "Patients speak or tap. English and Hindi today, with a modular voice layer built to add more Indian languages.",
  },
  {
    icon: FileScan,
    title: "Medical Document Intelligence",
    body: "Upload prescriptions, lab reports and discharge summaries. OCR + AI extract medicines, doses, results and dates you can correct.",
  },
  {
    icon: Sparkles,
    title: "Smart Clinical Summary",
    body: "Interview + prior records retrieved semantically + current documents are combined into one physician-ready summary.",
  },
  {
    icon: CalendarClock,
    title: "Patient Timeline",
    body: "Dates are extracted from documents and arranged chronologically so the story of the illness is visible at a glance.",
  },
  {
    icon: LayoutDashboard,
    title: "Doctor Dashboard",
    body: "A prioritised queue with red-flag badges, editable AI summaries, attention points and intake analytics.",
  },
];

const FLOW = [
  "Patient", "Voice / Touch", "Adaptive AI questions", "Document OCR",
  "Semantic retrieval", "Structured summary", "Doctor dashboard",
];

export default function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              History-collection assistant · not a diagnostic tool
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-clinical-ink sm:text-5xl">
              MACI
              <span className="mt-1 block text-xl font-bold text-clinical-muted sm:text-2xl">
                Multilingual AI Clinical Intake Platform
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-clinical-muted">{t("app.tagline")}</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/intake" className="btn-primary px-5 py-3 text-base">
                <Stethoscope className="h-5 w-5" />
                Start a patient intake
              </Link>
              <Link to="/doctor" className="btn-outline px-5 py-3 text-base">
                <LayoutDashboard className="h-5 w-5" />
                Open doctor dashboard
              </Link>
            </div>
          </div>

          {/* Flow strip */}
          <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-xs font-semibold text-clinical-muted">
            {FLOW.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-full border border-clinical-line bg-white px-3 py-1.5">{step}</span>
                {i < FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-clinical-ink">
          Everything the doctor needs — before the consultation
        </h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-bold text-clinical-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-clinical-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety band */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="card grid gap-6 p-6 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="text-lg font-bold text-clinical-ink">Safety-first by design</h3>
            <ul className="mt-3 space-y-2 text-sm text-clinical-muted">
              <li>• A deterministic rule-based red-flag layer runs on every message — independent of the LLM.</li>
              <li>• Structured AI output is validated with Pydantic; malformed JSON is repaired or safely rejected.</li>
              <li>• Strict per-patient isolation on every semantic retrieval.</li>
              <li>• Consent is recorded before any intake begins.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">This is a prototype.</p>
            <p className="mt-1 leading-relaxed">
              It does not provide a diagnosis and is not certified for HIPAA, India DPDP or ABDM. A formal
              security &amp; compliance review is required before production deployment.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
