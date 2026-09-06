import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Check,
  CheckCircle2,
  CircleDot,
  FileText,
  Gauge,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Square,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AYUSH_FIELDS, DOC_PIPELINE, DOCUMENT_TYPES, STEPS } from "../lib/constants";
import { humanFileSize, nonEmpty, titleCase } from "../lib/format";
import { ttsSupported, useSpeechRecognition } from "../lib/useVoice";
import { EASE, listItem, staggerParent } from "../lib/motion.jsx";
import {
  AiDraftNotice,
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PriorityBadge,
  RadioCards,
  Textarea,
  TextInput,
  cx,
} from "./ui.jsx";

/* --------------------------------------------------------------------- */
/* Progress stepper                                                       */
/* --------------------------------------------------------------------- */
export function ProgressStepper({ current, onJump }) {
  const pct = STEPS.length > 1 ? (current / (STEPS.length - 1)) * 100 : 0;
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-4 h-0.5 rounded-full bg-border" />
      <motion.div
        className="absolute left-0 top-4 h-0.5 rounded-full bg-primary-sheen"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: EASE }}
      />
      <ol className="relative flex justify-between">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = i <= current && typeof onJump === "function";
          return (
            <li key={s.key} className="flex min-w-0 flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onJump(i)}
                className={cx(
                  "grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold transition",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                    ? "border-primary bg-card text-primary shadow-[0_0_0_4px_rgb(var(--primary)/0.15)]"
                    : "border-border bg-card text-fg-subtle",
                  clickable && "hover:brightness-110"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </button>
              <span
                className={cx(
                  "hidden max-w-[7rem] truncate text-center text-[11px] font-semibold sm:block",
                  active ? "text-fg" : "text-fg-subtle"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-[11px] font-semibold text-fg-subtle sm:hidden">
        Step {current + 1} of {STEPS.length} · {STEPS[current]?.label}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Red-flag banner                                                        */
/* --------------------------------------------------------------------- */
export function RedFlagBanner({ triage }) {
  if (!triage?.red_flag) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      role="alert"
      className="relative overflow-hidden rounded-2xl border border-critical/40 bg-critical/10 p-4"
    >
      <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-2xl border border-critical/40" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-critical/40 bg-critical/15 text-critical">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-critical">Potential urgent symptom detected</p>
          <p className="mt-0.5 text-sm text-fg">Please contact medical staff immediately.</p>
          {nonEmpty(triage.hits) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {triage.hits.map((h) => (
                <Badge key={h.rule_id + h.label} tone="critical">
                  {h.label}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-fg-muted">
            Automated screening only — not a diagnosis, and nothing has been confirmed.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* --------------------------------------------------------------------- */
/* Voice                                                                  */
/* --------------------------------------------------------------------- */
function Waveform({ active }) {
  const bars = [0.5, 0.9, 0.35, 0.75, 1, 0.55, 0.85, 0.4, 0.7];
  return (
    <div className="flex h-6 items-center gap-[3px]">
      {bars.map((b, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-primary"
          animate={active ? { scaleY: [b * 0.4, b, b * 0.4] } : { scaleY: 0.25 }}
          transition={{ repeat: active ? Infinity : 0, duration: 0.9 + (i % 3) * 0.15, ease: "easeInOut" }}
          style={{ height: 24, originY: 0.5 }}
        />
      ))}
    </div>
  );
}

export function VoiceOrb({ langCode, onFinalTranscript, className = "" }) {
  const { supported, listening, interim, error, start, stop } = useSpeechRecognition(langCode);
  useEffect(() => () => stop(), [stop]);

  if (!supported) {
    return (
      <Alert tone="warning" title="Voice input unavailable" icon={MicOff}>
        This browser doesn’t support speech recognition. Please type your answer instead.
      </Alert>
    );
  }
  return (
    <div className={cx("flex flex-col items-center gap-4", className)}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start((text) => onFinalTranscript(text)))}
        aria-pressed={listening}
        className="relative grid h-28 w-28 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      >
        {listening && (
          <>
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20 [animation-delay:0.6s]" />
          </>
        )}
        <span
          className={cx(
            "relative grid h-20 w-20 place-items-center rounded-full text-white shadow-glow transition",
            listening ? "bg-critical" : "bg-primary-sheen"
          )}
        >
          {listening ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
        </span>
      </button>

      <div className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={cx(
            "h-2 w-2 rounded-full",
            listening ? "animate-pulse bg-critical" : "bg-fg-subtle"
          )}
        />
        <span className="text-fg">{listening ? "Listening…" : "Tap to speak"}</span>
      </div>

      {listening && <Waveform active />}

      {interim && (
        <p className="max-w-md rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm text-fg-muted">
          {interim}
        </p>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      {listening && (
        <Button variant="outline" size="sm" onClick={stop}>
          <Square className="h-3.5 w-3.5" /> Stop
        </Button>
      )}
    </div>
  );
}

export function MicButton({ langCode, onTranscript, large = false }) {
  const { supported, listening, interim, error, start, stop } = useSpeechRecognition(langCode);
  useEffect(() => () => stop(), [stop]);
  if (!supported) {
    return <p className="text-xs text-fg-subtle">Voice input isn’t available in this browser — please type instead.</p>;
  }
  return (
    <div className={cx("flex flex-col gap-1.5", large ? "items-stretch" : "items-start")}>
      <Button
        type="button"
        variant={listening ? "danger" : "outline"}
        size={large ? "lg" : "sm"}
        className={large ? "w-full" : ""}
        onClick={() => (listening ? stop() : start((text) => onTranscript(text)))}
        aria-pressed={listening}
      >
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {listening ? "Stop recording" : "Tap to speak"}
      </Button>
      {listening && <p className="text-xs text-fg-muted">Listening… {interim}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Chat interview panel                                                   */
/* --------------------------------------------------------------------- */
function ChatBubble({ role, text, i }) {
  const isPatient = role === "patient";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.02, 0.2) }}
      className={cx("flex", isPatient ? "justify-end" : "justify-start")}
    >
      {!isPatient && (
        <span className="mr-2 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      )}
      <div
        className={cx(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-card",
          isPatient
            ? "rounded-br-md bg-primary-sheen text-primary-foreground"
            : "rounded-bl-md border border-border bg-elevated text-fg"
        )}
      >
        {text}
      </div>
    </motion.div>
  );
}

export function ChatPanel({
  transcript,
  langCode,
  mode,
  pending,
  speakAloud,
  onToggleSpeak,
  onSend,
  suggestions,
  isComplete,
  onFinish,
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, pending]);

  const send = (text) => {
    const value = (text ?? draft).trim();
    if (!value || pending) return;
    setDraft("");
    onSend(value);
  };

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold text-fg">
        <Brain className="h-4 w-4 text-primary" /> Clinical interview
        <span className="ml-auto text-xs font-medium text-fg-subtle">One question at a time · no diagnosis</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {transcript.length === 0 && !pending && (
          <p className="text-sm text-fg-subtle">The assistant will ask its first question…</p>
        )}
        {transcript.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} i={i} />
        ))}
        {pending && (
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-elevated px-3 py-2.5">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-fg-subtle"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay: d * 0.15 }}
                />
              ))}
              <span className="ml-1.5 text-xs text-fg-muted">Analyzing your answer…</span>
            </div>
          </div>
        )}
      </div>

      {nonEmpty(suggestions) && !isComplete && !pending && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="chip">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3">
        {isComplete ? (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> History collected
            </p>
            <Button onClick={onFinish}>Continue</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your answer…"
                className="min-h-[46px] flex-1"
                rows={1}
              />
              <Button onClick={() => send()} loading={pending} aria-label="Send" className="h-11 w-11 p-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {mode === "voice" ? (
                <MicButton langCode={langCode} onTranscript={(txt) => setDraft((d) => (d ? `${d} ${txt}` : txt))} />
              ) : (
                <span className="text-xs text-fg-subtle">
                  <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span>+
                  <span className="kbd">Enter</span> for a new line
                </span>
              )}
              {ttsSupported() && (
                <button
                  onClick={onToggleSpeak}
                  className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle transition hover:text-fg"
                  aria-pressed={speakAloud}
                >
                  {speakAloud ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
                  Read aloud
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Live clinical intelligence panel                                       */
/* --------------------------------------------------------------------- */
function Ring({ value = 0 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--border))" strokeWidth="6" />
      <motion.circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="rgb(var(--primary))"
        strokeWidth="6"
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c - (c * v) / 100 }}
        transition={{ duration: 0.6, ease: EASE }}
      />
      <text x="32" y="36" textAnchor="middle" className="fill-fg text-[13px] font-bold">
        {Math.round(v)}%
      </text>
    </svg>
  );
}

export function ClinicalIntelligencePanel({ chiefComplaint, history, triage, completionPct = 0, questionCount = 0 }) {
  const symptoms = useMemo(() => {
    const hpi = history?.history_of_present_illness || {};
    const s = new Set();
    (hpi.associated_symptoms || []).forEach((x) => x && s.add(x));
    if (hpi.character) s.add(hpi.character);
    return [...s].slice(0, 8);
  }, [history]);
  const collected = useMemo(() => {
    const hpi = history?.history_of_present_illness || {};
    return [
      ["Onset / duration", hpi.onset || hpi.duration],
      ["Severity", hpi.severity],
      ["Past medical", nonEmpty(history?.past_medical_history) ? history.past_medical_history.join(", ") : ""],
      ["Medications", nonEmpty(history?.medications) ? history.medications.map((m) => m.name).filter(Boolean).join(", ") : ""],
      ["Allergies", nonEmpty(history?.allergies) ? history.allergies.join(", ") : ""],
    ].filter(([, v]) => v);
  }, [history]);
  const missing = history?.missing_information || [];
  const priority = triage?.priority || history?.triage_priority || "standard";

  return (
    <div className="flex h-[520px] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Gauge className="h-4 w-4 text-primary" /> Live Clinical Intelligence
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <Ring value={completionPct} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Interview completion</p>
          <p className="text-sm text-fg">{questionCount} question{questionCount === 1 ? "" : "s"} answered</p>
          <div className="mt-1"><PriorityBadge priority={priority} /></div>
        </div>
      </div>

      <IntelBlock label="Chief complaint">
        <p className="text-sm text-fg">{chiefComplaint || history?.chief_complaint || "—"}</p>
      </IntelBlock>

      <IntelBlock label="Symptoms detected">
        {symptoms.length ? (
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map((s) => (
              <Badge key={s} tone="primary">{titleCase(s)}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">Listening…</p>
        )}
      </IntelBlock>

      <IntelBlock label="History collected">
        {collected.length ? (
          <dl className="space-y-1 text-sm">
            {collected.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-fg-subtle">{k}</dt>
                <dd className="min-w-0 flex-1 text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-fg-subtle">Nothing structured yet</p>
        )}
      </IntelBlock>

      {nonEmpty(missing) && (
        <IntelBlock label="Still needed">
          <div className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <Badge key={m} tone="warning">{m}</Badge>
            ))}
          </div>
        </IntelBlock>
      )}

      {triage?.red_flag && (
        <div className="rounded-xl border border-critical/35 bg-critical/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-critical">
            <AlertTriangle className="h-3.5 w-3.5" /> Red flags
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-fg">
            {(triage.hits || []).map((h) => (
              <li key={h.rule_id + h.label}>• {h.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IntelBlock({ label, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">{label}</p>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Documents                                                              */
/* --------------------------------------------------------------------- */
export function DocumentDropzone({ onPick, busy }) {
  const inputRef = useRef(null);
  const [type, setType] = useState("prescription");
  const [drag, setDrag] = useState(false);
  const pick = (file) => file && onPick(file, type);

  return (
    <div className="space-y-3">
      <Field label="Document type" hint="Helps the AI structure the extracted data.">
        <RadioCards
          value={type}
          onChange={setType}
          columns={3}
          options={DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
        />
      </Field>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition",
          drag ? "border-primary bg-primary/8 scale-[1.01]" : "border-border bg-surface/60"
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-elevated text-primary">
          <Upload className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-semibold text-fg">Drag &amp; drop a file, or tap to choose</p>
        <p className="mt-0.5 text-xs text-fg-subtle">PDF · PNG · JPG · TIFF · text file — up to 15 MB</p>
        <Button variant="outline" size="sm" className="mt-4" loading={busy} onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".pdf,.png,.jpg,.jpeg,.gif,.tif,.tiff,.bmp,.txt,.csv,.json,.md,image/*"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
// Back-compat alias
export const DocumentUploader = ({ onPick, busy }) => <DocumentDropzone onPick={onPick} busy={busy} />;

const PIPELINE_INDEX = { uploaded: 0, ocr_running: 1, ocr_done: 2, structured: 3, failed: -1 };

function DocPipeline({ status, processing }) {
  const idx = processing && status === "uploaded" ? 1 : PIPELINE_INDEX[status] ?? 0;
  const failed = status === "failed";
  return (
    <div className="flex items-center gap-1.5">
      {DOC_PIPELINE.map((p, i) => {
        const state = failed && i > 0 ? "fail" : i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <div key={p.key} className="flex items-center gap-1.5">
            <span
              className={cx(
                "grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold",
                state === "done" && "border-success bg-success/15 text-success",
                state === "active" && "border-primary bg-primary/15 text-primary",
                state === "fail" && "border-danger bg-danger/15 text-danger",
                state === "todo" && "border-border text-fg-subtle"
              )}
              title={p.label}
            >
              {state === "done" ? (
                <Check className="h-3 w-3" />
              ) : state === "active" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : state === "fail" ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <CircleDot className="h-2.5 w-2.5" />
              )}
            </span>
            {i < DOC_PIPELINE.length - 1 && (
              <span className={cx("h-px w-4", i < idx ? "bg-success" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DocumentCard({ doc, onProcess, onSaveCorrection, processing }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(doc.ocr_text || "");
  const s = doc.structured;
  const failed = doc.status === "failed";
  useEffect(() => setText(doc.ocr_text || ""), [doc.ocr_text]);

  return (
    <Card className="overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-elevated text-fg-muted">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">{doc.filename}</p>
            <p className="text-xs text-fg-subtle">
              {titleCase(doc.document_type)} · {humanFileSize(doc.size_bytes)}
              {s?.document_date ? ` · ${s.document_date}` : ""}
            </p>
          </div>
        </div>
        <Badge
          tone={doc.status === "structured" ? "success" : failed ? "danger" : "neutral"}
        >
          {titleCase(doc.status)}
        </Badge>
      </div>

      <div className="mt-3">
        <DocPipeline status={doc.status} processing={processing} />
      </div>

      {doc.error && (
        <p className="mt-2 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2 text-xs text-danger">{doc.error}</p>
      )}

      {s && <OcrResultView structured={s} rawText={doc.ocr_text} compact />}

      {editing && (
        <div className="mt-3">
          <Field label="Extracted text — correct any OCR mistakes">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[140px] font-mono text-xs"
            />
          </Field>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onSaveCorrection(doc.id, { ocr_text: text });
                setEditing(false);
              }}
            >
              Save &amp; re-extract
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {doc.status === "uploaded" && (
          <Button size="sm" onClick={() => onProcess(doc.id)} loading={processing}>
            <Sparkles className="h-4 w-4" /> Extract details
          </Button>
        )}
        {(doc.status === "structured" || failed) && (
          <Button size="sm" variant="outline" onClick={() => onProcess(doc.id)} loading={processing}>
            Re-extract
          </Button>
        )}
        {(doc.ocr_text || failed) && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {doc.ocr_text ? "View / correct text" : "Enter text manually"}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------------- */
/* OCR structured result                                                  */
/* --------------------------------------------------------------------- */
export function OcrResultView({ structured: s, rawText, compact = false }) {
  if (!s) return null;
  const meds = s.medications || [];
  const labs = s.lab_results || [];
  const meta = [
    s.document_date && ["Date", s.document_date],
    s.hospital_or_clinic && ["Facility", s.hospital_or_clinic],
    s.doctor_name && ["Doctor", s.doctor_name],
    s.follow_up && ["Follow-up", s.follow_up],
  ].filter(Boolean);

  return (
    <div className={cx("mt-3 space-y-3", compact ? "" : "")}>
      <div className="grid gap-3 md:grid-cols-2">
        <KVBlock title="Diagnoses" items={s.diagnoses} tone="primary" />
        <KVBlock
          title="Procedures / surgeries"
          items={[...(s.procedures || []), ...(s.previous_surgeries || [])]}
        />
      </div>

      {meds.length > 0 && (
        <div className="rounded-xl border border-border bg-surface/60 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Medications</p>
          <div className="grid gap-1.5">
            {meds.map((m, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="font-semibold text-fg">{m.name || "—"}</span>
                {m.dosage && <span className="text-fg-muted">{m.dosage}</span>}
                {m.frequency && <Badge tone="neutral">{m.frequency}</Badge>}
                {m.route && <span className="text-xs text-fg-subtle">{m.route}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {labs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1.6fr_1fr_1.2fr] gap-2 bg-surface/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
            <span>Test</span>
            <span>Result</span>
            <span>Reference</span>
          </div>
          {labs.map((l, i) => (
            <div key={i} className="grid grid-cols-[1.6fr_1fr_1.2fr] gap-2 border-t border-border px-3 py-2 text-sm">
              <span className="text-fg">{l.test_name || "—"}</span>
              <span className={cx("font-semibold", l.flag ? "text-warning" : "text-fg")}>
                {[l.value, l.unit].filter(Boolean).join(" ") || "—"}
                {l.flag ? ` (${l.flag})` : ""}
              </span>
              <span className="text-fg-muted">{l.reference_range || "—"}</span>
            </div>
          ))}
        </div>
      )}

      {meta.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {meta.map(([k, v]) => (
            <Badge key={k} tone="neutral">
              <span className="text-fg-subtle">{k}:</span> {v}
            </Badge>
          ))}
        </div>
      )}

      {rawText && (
        <details className="group rounded-xl border border-border bg-surface/50">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-fg-muted transition group-open:text-fg">
            Raw OCR text vs. AI-structured information
          </summary>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap border-t border-border p-3 text-[11px] leading-relaxed text-fg-subtle">
            {rawText}
          </pre>
        </details>
      )}
    </div>
  );
}

function KVBlock({ title, items, tone = "neutral" }) {
  const list = (items || []).filter(Boolean);
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">{title}</p>
      {list.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {list.map((it, i) => (
            <Badge key={i} tone={tone}>{it}</Badge>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-fg-subtle">None found</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Structured history view (shared with the doctor dashboard)             */
/* --------------------------------------------------------------------- */
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-1.5 text-sm">
      <dt className="font-semibold text-fg-subtle">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}
function HSection({ title, children }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-fg-subtle">{title}</h4>
      {children}
    </div>
  );
}
function ListSection({ title, items }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <p className="text-sm font-bold text-fg">{title}</p>
      {nonEmpty(items) ? (
        <ul className="mt-1 space-y-0.5 text-sm text-fg-muted">
          {items.filter(Boolean).map((it, i) => (
            <li key={i}>• {it}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-fg-subtle">Not recorded</p>
      )}
    </div>
  );
}

export function StructuredHistoryView({ history }) {
  if (!history) return null;
  const hpi = history.history_of_present_illness || {};
  const ph = history.personal_history || {};
  const ros = history.review_of_systems || {};
  const listOr = (arr, j = ", ") => (nonEmpty(arr) ? arr.join(j) : "");

  return (
    <div className="space-y-4">
      <HSection title="Chief complaint">
        <p className="text-sm text-fg">{history.chief_complaint || "—"}</p>
      </HSection>

      <HSection title="History of present illness">
        <dl className="divide-y divide-border">
          <Row label="Onset" value={hpi.onset} />
          <Row label="Duration" value={hpi.duration} />
          <Row label="Location" value={hpi.location} />
          <Row label="Character" value={hpi.character} />
          <Row label="Severity" value={hpi.severity} />
          <Row label="Radiation" value={hpi.radiation} />
          <Row label="Aggravating" value={listOr(hpi.aggravating_factors)} />
          <Row label="Relieving" value={listOr(hpi.relieving_factors)} />
          <Row label="Associated" value={listOr(hpi.associated_symptoms)} />
          <Row label="Progression" value={hpi.progression} />
        </dl>
      </HSection>

      <div className="grid gap-4 sm:grid-cols-2">
        <ListSection title="Past medical history" items={history.past_medical_history} />
        <ListSection title="Past surgical history" items={history.past_surgical_history} />
        <ListSection
          title="Current medications"
          items={(history.medications || []).map((m) =>
            [m.name, m.dosage, m.frequency, m.route].filter(Boolean).join(" · ")
          )}
        />
        <ListSection title="Allergies" items={history.allergies} />
        <ListSection title="Family history" items={history.family_history} />
        <ListSection title="Previous investigations" items={history.previous_investigations} />
      </div>

      <HSection title="Personal / social history">
        <dl className="divide-y divide-border">
          <Row label="Smoking" value={ph.smoking} />
          <Row label="Alcohol" value={ph.alcohol} />
          <Row label="Diet" value={ph.diet} />
          <Row label="Sleep" value={ph.sleep} />
          <Row label="Exercise" value={ph.exercise} />
          <Row label="Occupation" value={ph.occupation} />
        </dl>
      </HSection>

      {Object.keys(ros).length > 0 && (
        <HSection title="Review of systems">
          <dl className="divide-y divide-border">
            {Object.entries(ros).map(([k, v]) => (
              <Row key={k} label={titleCase(k)} value={String(v)} />
            ))}
          </dl>
        </HSection>
      )}

      {nonEmpty(history.missing_information) && (
        <Alert tone="warning" title="Not yet collected">
          {history.missing_information.join(", ")}
        </Alert>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* AYUSH form                                                             */
/* --------------------------------------------------------------------- */
export function AyushForm({ value, onChange, onSave, saving }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-fg">AYUSH / Ayurveda assessment</h3>
          <p className="text-xs text-fg-muted">Optional. Kept separate from the standard clinical intake.</p>
        </div>
        <Badge tone="accent">AYUSH mode</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AYUSH_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            <TextInput value={value[key] || ""} onChange={(e) => onChange({ ...value, [key]: e.target.value })} placeholder="—" />
          </Field>
        ))}
      </div>
      <Field className="mt-3" label="Additional notes" hint="Prakriti–Vikriti reasoning, Ahara–Vihara details, etc.">
        <Textarea
          value={value.additional_notes || ""}
          onChange={(e) => onChange({ ...value, additional_notes: e.target.value })}
        />
      </Field>
      <Button className="mt-3" onClick={onSave} loading={saving}>
        Save assessment
      </Button>
    </Card>
  );
}

/* --------------------------------------------------------------------- */
/* Summary review (patient side)                                          */
/* --------------------------------------------------------------------- */
export function SummaryReview({ summary }) {
  if (!summary) return <EmptyState title="No summary yet" subtitle="Generate the summary to review it." />;
  return (
    <motion.div
      variants={staggerParent(0.08)}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      <motion.div variants={listItem}>
        <AiDraftNotice />
      </motion.div>
      <motion.div variants={listItem}>
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Narrative for your doctor</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{summary.narrative || "—"}</p>
        </Card>
      </motion.div>

      {nonEmpty(summary.red_flags) && (
        <motion.div variants={listItem}>
          <Alert tone="critical" title="Points flagged for staff attention">
            <ul className="mt-1 space-y-0.5">
              {summary.red_flags.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-fg-subtle">Automated screening only — not a confirmed diagnosis.</p>
          </Alert>
        </motion.div>
      )}

      <motion.div variants={listItem}>
        <Card className="p-5">
          <StructuredHistoryView history={summary.history} />
        </Card>
      </motion.div>
    </motion.div>
  );
}

// legacy export name kept for any external import
export const ProgressSteps = ({ current }) => <ProgressStepper current={current} />;
