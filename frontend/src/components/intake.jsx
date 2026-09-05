import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AYUSH_FIELDS, DOCUMENT_TYPES, STEPS } from "../lib/constants";
import { humanFileSize, nonEmpty, titleCase } from "../lib/format";
import { ttsSupported, useSpeechRecognition } from "../lib/useVoice";
import { AiDraftNotice, Badge, Button, Card, EmptyState, Field, Select, TextInput, Textarea } from "./ui.jsx";

/* --------------------------------------------------------------------- */
/* Progress indicator                                                     */
/* --------------------------------------------------------------------- */
export function ProgressSteps({ current }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
                done
                  ? "border-brand-600 bg-brand-600 text-white"
                  : active
                  ? "border-brand-600 bg-white text-brand-700"
                  : "border-clinical-line bg-white text-clinical-muted"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm font-semibold ${active ? "text-clinical-ink" : "text-clinical-muted"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-clinical-line sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------- */
/* Red-flag banner                                                        */
/* --------------------------------------------------------------------- */
export function RedFlagBanner({ triage }) {
  if (!triage?.red_flag) return null;
  return (
    <div
      role="alert"
      className="animate-fade-in rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
        <div>
          <p className="text-base font-bold">Potential urgent symptom detected</p>
          <p className="mt-0.5 text-sm">Please contact medical staff immediately.</p>
          {nonEmpty(triage.hits) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {triage.hits.map((h) => (
                <Badge key={h.rule_id + h.label} className="border-rose-200 bg-white text-rose-700">
                  {h.label}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-rose-700/90">
            This is automated screening only — not a diagnosis, and nothing has been confirmed.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Voice mic button                                                       */
/* --------------------------------------------------------------------- */
export function MicButton({ langCode, onTranscript, large = false }) {
  const { supported, listening, interim, error, start, stop } = useSpeechRecognition(langCode);

  useEffect(() => () => stop(), [stop]);

  if (!supported) {
    return (
      <p className="text-xs text-clinical-muted">
        Voice input isn’t available in this browser — please type instead.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => (listening ? stop() : start((text) => onTranscript(text)))}
        className={`btn ${listening ? "btn-danger" : "btn-primary"} ${
          large ? "min-h-[72px] w-full px-6 text-lg" : "px-4 py-2.5"
        }`}
        aria-pressed={listening}
      >
        {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        {listening ? "Stop" : "Tap to speak"}
      </button>
      {listening && <p className="text-xs text-clinical-muted">Listening… {interim}</p>}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Chat interview panel                                                   */
/* --------------------------------------------------------------------- */
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
    <div className="flex h-[460px] flex-col overflow-hidden rounded-2xl border border-clinical-line bg-white">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {transcript.length === 0 && (
          <p className="text-sm text-clinical-muted">The assistant will ask its first question…</p>
        )}
        {transcript.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-clinical-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {nonEmpty(suggestions) && !isComplete && (
        <div className="flex flex-wrap gap-1.5 border-t border-clinical-line px-3 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={pending}
              className="rounded-full border border-clinical-line bg-clinical-bg px-3 py-1 text-xs font-medium hover:bg-brand-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-clinical-line p-3">
        {isComplete ? (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" /> History collected
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
              <Button onClick={() => send()} loading={pending} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              {mode === "voice" ? (
                <MicButton langCode={langCode} onTranscript={(t) => setDraft((d) => (d ? `${d} ${t}` : t))} />
              ) : (
                <span className="text-xs text-clinical-muted">Press Enter to send · Shift+Enter for a new line</span>
              )}
              {ttsSupported() && (
                <button
                  onClick={onToggleSpeak}
                  className="flex items-center gap-1.5 text-xs font-medium text-clinical-muted hover:text-clinical-ink"
                >
                  {speakAloud ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
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

function ChatBubble({ role, text }) {
  const isPatient = role === "patient";
  return (
    <div className={`flex ${isPatient ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
          isPatient
            ? "rounded-br-md bg-brand-600 text-white"
            : "rounded-bl-md border border-clinical-line bg-clinical-bg text-clinical-ink"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Document uploader + list                                               */
/* --------------------------------------------------------------------- */
export function DocumentUploader({ onPick, busy }) {
  const inputRef = useRef(null);
  const [type, setType] = useState("prescription");
  const [drag, setDrag] = useState(false);

  const pick = (file) => file && onPick(file, type);

  return (
    <div>
      <div className="mb-3 max-w-xs">
        <Field label="Document type">
          <Select value={type} onChange={(e) => setType(e.target.value)} options={DOCUMENT_TYPES} />
        </Field>
      </div>
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
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
          drag ? "border-brand-400 bg-brand-50" : "border-clinical-line bg-white"
        }`}
      >
        <Upload className="h-7 w-7 text-clinical-muted" />
        <p className="mt-2 text-sm font-semibold text-clinical-ink">Tap to choose a file or drop it here</p>
        <p className="mt-0.5 text-xs text-clinical-muted">PDF, PNG, JPG, TIFF or a text file · up to 15 MB</p>
        <Button variant="outline" className="mt-3" loading={busy} onClick={() => inputRef.current?.click()}>
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

export function DocumentCard({ doc, onProcess, onSaveCorrection, processing }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(doc.ocr_text || "");
  const s = doc.structured;
  const failed = doc.status === "failed";

  useEffect(() => setText(doc.ocr_text || ""), [doc.ocr_text]);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-clinical-bg text-clinical-muted">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-clinical-ink">{doc.filename}</p>
            <p className="text-xs text-clinical-muted">
              {titleCase(doc.document_type)} · {humanFileSize(doc.size_bytes)}
            </p>
          </div>
        </div>
        <Badge
          className={
            doc.status === "structured"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : failed
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-clinical-line bg-clinical-bg text-clinical-muted"
          }
        >
          {titleCase(doc.status)}
        </Badge>
      </div>

      {doc.error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{doc.error}</p>}

      {s && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MiniList title="Diagnoses" items={s.diagnoses} />
          <MiniList
            title="Medications"
            items={(s.medications || []).map((m) =>
              [m.name, m.dosage, m.frequency].filter(Boolean).join(" · ")
            )}
          />
          <MiniList
            title="Lab results"
            items={(s.lab_results || []).map((l) =>
              `${l.test_name}: ${l.value} ${l.unit} ${l.reference_range ? `(ref ${l.reference_range})` : ""}`.trim()
            )}
          />
          <MiniList
            title="Details"
            items={[
              s.document_date && `Date: ${s.document_date}`,
              s.hospital_or_clinic && `Facility: ${s.hospital_or_clinic}`,
              s.doctor_name && s.doctor_name,
              s.follow_up && `Follow-up: ${s.follow_up}`,
            ].filter(Boolean)}
          />
        </div>
      )}

      {editing && (
        <div className="mt-3">
          <Field label="Extracted text — correct any OCR mistakes">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[140px] font-mono text-xs" />
          </Field>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={() => {
                onSaveCorrection(doc.id, { ocr_text: text });
                setEditing(false);
              }}
            >
              Save &amp; re-extract
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {doc.status === "uploaded" && (
          <Button onClick={() => onProcess(doc.id)} loading={processing} variant="primary">
            <Sparkles className="h-4 w-4" /> Extract details
          </Button>
        )}
        {(doc.status === "structured" || failed) && (
          <Button variant="outline" onClick={() => onProcess(doc.id)} loading={processing}>
            Re-extract
          </Button>
        )}
        {(doc.ocr_text || failed) && !editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {doc.ocr_text ? "View / correct text" : "Enter text manually"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function MiniList({ title, items }) {
  const list = (items || []).filter(Boolean);
  return (
    <div className="rounded-xl border border-clinical-line bg-clinical-bg/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-clinical-muted">{title}</p>
      {list.length ? (
        <ul className="mt-1 space-y-0.5 text-sm text-clinical-ink">
          {list.map((it, i) => (
            <li key={i}>• {it}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-clinical-muted">None found</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Structured history view (shared with doctor dashboard)                 */
/* --------------------------------------------------------------------- */
export function StructuredHistoryView({ history }) {
  if (!history) return null;
  const hpi = history.history_of_present_illness || {};
  const ph = history.personal_history || {};
  const ros = history.review_of_systems || {};

  const Row = ({ label, value }) =>
    value ? (
      <div className="grid grid-cols-[130px_1fr] gap-3 py-1.5 text-sm">
        <dt className="font-semibold text-clinical-muted">{label}</dt>
        <dd className="text-clinical-ink">{value}</dd>
      </div>
    ) : null;

  const listOr = (arr, joiner = ", ") => (nonEmpty(arr) ? arr.join(joiner) : "");

  return (
    <div className="space-y-4">
      <Section title="Chief complaint">
        <p className="text-sm text-clinical-ink">{history.chief_complaint || "—"}</p>
      </Section>

      <Section title="History of present illness">
        <dl className="divide-y divide-clinical-line">
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
      </Section>

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

      <Section title="Personal / social history">
        <dl className="divide-y divide-clinical-line">
          <Row label="Smoking" value={ph.smoking} />
          <Row label="Alcohol" value={ph.alcohol} />
          <Row label="Diet" value={ph.diet} />
          <Row label="Sleep" value={ph.sleep} />
          <Row label="Exercise" value={ph.exercise} />
          <Row label="Occupation" value={ph.occupation} />
        </dl>
      </Section>

      {Object.keys(ros).length > 0 && (
        <Section title="Review of systems">
          <dl className="divide-y divide-clinical-line">
            {Object.entries(ros).map(([k, v]) => (
              <Row key={k} label={titleCase(k)} value={String(v)} />
            ))}
          </dl>
        </Section>
      )}

      {nonEmpty(history.missing_information) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Not yet collected</p>
          <p className="mt-0.5">{history.missing_information.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-clinical-muted">{title}</h4>
      {children}
    </div>
  );
}

function ListSection({ title, items }) {
  return (
    <div className="rounded-xl border border-clinical-line bg-white p-3">
      <p className="text-sm font-bold text-clinical-ink">{title}</p>
      {nonEmpty(items) ? (
        <ul className="mt-1 space-y-0.5 text-sm text-clinical-muted">
          {items.filter(Boolean).map((it, i) => (
            <li key={i}>• {it}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-clinical-muted">Not recorded</p>
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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-clinical-ink">AYUSH / Ayurveda assessment</h3>
          <p className="text-xs text-clinical-muted">
            Optional. Kept separate from the standard clinical intake.
          </p>
        </div>
        <Badge className="border-brand-200 bg-brand-50 text-brand-700">AYUSH mode</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AYUSH_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            <TextInput
              value={value[key] || ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              placeholder="—"
            />
          </Field>
        ))}
      </div>
      <Field label="Additional notes" hint="Prakriti–Vikriti reasoning, Ahara–Vihara details, etc.">
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
    <div className="space-y-4">
      <AiDraftNotice />
      <Card className="p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-clinical-muted">Narrative for your doctor</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-clinical-ink">
          {summary.narrative || "—"}
        </p>
      </Card>

      {nonEmpty(summary.red_flags) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-rose-800">
            <AlertTriangle className="h-4 w-4" /> Points flagged for staff attention
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-rose-700">
            {summary.red_flags.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-rose-700/80">Automated screening only — not a confirmed diagnosis.</p>
        </div>
      )}

      <Card className="p-5">
        <StructuredHistoryView history={summary.history} />
      </Card>
    </div>
  );
}
