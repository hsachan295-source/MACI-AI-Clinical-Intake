import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
} from "lucide-react";
import { initials, nonEmpty, titleCase } from "../lib/format";
import { AiDraftNotice, Badge, Button, Card, EmptyState, Field, PriorityBadge, RedFlagPill, Textarea } from "./ui.jsx";
import { StructuredHistoryView } from "./intake.jsx";

const CHART_COLORS = ["#1a63db", "#2f83f5", "#59a6ff", "#8ec6ff", "#bcdcff", "#f59e0b", "#ef4444"];

/* --------------------------------------------------------------------- */
/* Queue table                                                            */
/* --------------------------------------------------------------------- */
export function QueueTable({ items, loading }) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </Card>
    );
  }
  if (!nonEmpty(items)) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No patients waiting"
        subtitle="Submitted intakes will appear here, highest priority first."
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1.6fr_1.4fr_0.8fr_0.9fr_0.8fr] gap-3 border-b border-clinical-line bg-clinical-bg/60 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-clinical-muted md:grid">
        <span>Patient</span>
        <span>Chief complaint</span>
        <span>Priority</span>
        <span>Intake</span>
        <span>Waiting</span>
      </div>
      <ul className="divide-y divide-clinical-line">
        {items.map((it) => (
          <li key={it.session_id}>
            <Link
              to={`/doctor/patients/${it.patient_id}?session=${it.session_id}`}
              className="grid gap-2 px-4 py-3.5 transition hover:bg-clinical-bg/60 md:grid-cols-[1.6fr_1.4fr_0.8fr_0.9fr_0.8fr] md:items-center md:gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {initials(it.patient_name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-clinical-ink">{it.patient_name}</p>
                  <p className="truncate text-xs text-clinical-muted">
                    {[it.age ? `${it.age}y` : null, titleCase(it.gender), it.language?.toUpperCase()]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <p className="truncate text-sm text-clinical-ink">{it.chief_complaint || "—"}</p>
              <div className="flex items-center gap-1.5">
                <PriorityBadge priority={it.triage_priority} />
                {it.red_flag && <RedFlagPill />}
              </div>
              <div>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-clinical-line">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${it.completion_pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-clinical-muted">
                  {it.completion_pct}% · {titleCase(it.status)}
                </p>
              </div>
              <p className="text-xs text-clinical-muted">
                {it.waiting_minutes < 60
                  ? `${it.waiting_minutes} min`
                  : `${Math.round(it.waiting_minutes / 60)} hr`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --------------------------------------------------------------------- */
/* Analytics                                                              */
/* --------------------------------------------------------------------- */
export function AnalyticsCharts({ analytics }) {
  const complaint = (analytics?.by_complaint_category || []).filter((b) => b.value > 0);
  const priority = (analytics?.by_priority || []).filter((b) => b.value > 0);
  const activity = analytics?.intake_activity_by_hour || [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-clinical-ink">Patients by complaint category</p>
        {complaint.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={complaint} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5ebf3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#1a63db" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-clinical-ink">Priority distribution</p>
        {priority.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={priority} dataKey="value" nameKey="label" outerRadius={90} label>
                {priority.map((entry, i) => (
                  <Cell key={entry.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </Card>

      <Card className="p-4 lg:col-span-2">
        <p className="mb-3 text-sm font-bold text-clinical-ink">Intake activity by hour</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={activity} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5ebf3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#2f83f5" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-[240px] place-items-center text-sm text-clinical-muted">Not enough data yet</div>
  );
}

/* --------------------------------------------------------------------- */
/* Timeline                                                               */
/* --------------------------------------------------------------------- */
const TL_ICON = {
  diagnosis: Stethoscope,
  medication: Pill,
  lab: FlaskConical,
  procedure: ClipboardList,
  visit: CalendarClock,
  general: FileText,
};

export function TimelineView({ events }) {
  if (!nonEmpty(events)) return <EmptyState icon={CalendarClock} title="No timeline events" />;
  return (
    <ol className="relative ml-3 border-l-2 border-clinical-line">
      {events.map((e, i) => {
        const Icon = TL_ICON[e.category] || FileText;
        return (
          <li key={i} className="mb-5 ml-6">
            <span className="absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-brand-100 text-brand-700">
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-bold text-clinical-ink">{e.title}</p>
              <span className="text-xs font-medium text-clinical-muted">{e.date}</span>
            </div>
            {e.detail && <p className="text-sm text-clinical-muted">{e.detail}</p>}
            {e.source && e.source !== "current-visit" && (
              <p className="mt-0.5 text-[11px] text-clinical-muted/80">from {e.source}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------- */
/* Document intelligence                                                  */
/* --------------------------------------------------------------------- */
export function DocumentIntelligence({ documents }) {
  if (!nonEmpty(documents)) return <EmptyState icon={FileText} title="No documents uploaded" />;
  return (
    <div className="space-y-3">
      {documents.map((d) => {
        const s = d.structured || {};
        return (
          <Card key={d.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-clinical-muted" />
                <p className="text-sm font-semibold text-clinical-ink">{d.filename}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className="border-clinical-line bg-clinical-bg text-clinical-muted">
                  {titleCase(d.document_type)}
                </Badge>
                {d.corrected_by_user && (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Corrected</Badge>
                )}
              </div>
            </div>
            {d.error && <p className="mt-2 text-xs text-rose-600">{d.error}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <KV title="Diagnoses" items={s.diagnoses} />
              <KV
                title="Medications"
                items={(s.medications || []).map((m) =>
                  [m.name, m.dosage, m.frequency].filter(Boolean).join(" · ")
                )}
              />
              <KV
                title="Lab results"
                items={(s.lab_results || []).map(
                  (l) =>
                    `${l.test_name}: ${l.value} ${l.unit}${l.reference_range ? ` (ref ${l.reference_range})` : ""}${
                      l.flag ? ` [${l.flag}]` : ""
                    }`
                )}
              />
              <KV
                title="Meta"
                items={[
                  s.document_date && `Date: ${s.document_date}`,
                  s.hospital_or_clinic,
                  s.doctor_name,
                  s.follow_up && `Follow-up: ${s.follow_up}`,
                ].filter(Boolean)}
              />
            </div>
            {d.ocr_text && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-brand-700">Show raw OCR text</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-clinical-bg p-3 text-[11px] text-clinical-muted">
                  {d.ocr_text}
                </pre>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function KV({ title, items }) {
  const list = (items || []).filter(Boolean);
  return (
    <div className="rounded-xl border border-clinical-line bg-clinical-bg/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-clinical-muted">{title}</p>
      {list.length ? (
        <ul className="mt-1 space-y-0.5 text-sm text-clinical-ink">
          {list.map((x, i) => (
            <li key={i}>• {x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-clinical-muted">None</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Attention points + red flags                                          */
/* --------------------------------------------------------------------- */
export function AttentionPoints({ points, redFlags }) {
  return (
    <div className="space-y-3">
      {nonEmpty(redFlags) && (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-rose-800">
            <AlertTriangle className="h-4 w-4" /> Red flags
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-rose-700">
            {redFlags.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-rose-700/80">
            Deterministic + AI screening. Not a diagnosis — clinician assessment required.
          </p>
        </Card>
      )}
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-clinical-ink">
          <ClipboardList className="h-4 w-4 text-brand-600" /> AI attention points
        </p>
        {nonEmpty(points) ? (
          <ul className="mt-1.5 space-y-1 text-sm text-clinical-muted">
            {points.map((p, i) => (
              <li key={i}>• {p}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-clinical-muted">None suggested.</p>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Editable summary                                                       */
/* --------------------------------------------------------------------- */
export function EditableSummary({ summary, onSaveDraft, onConfirm, onReject, saving }) {
  const [narrative, setNarrative] = useState(summary.narrative || "");
  const [notes, setNotes] = useState(summary.doctor_notes || "");
  const [reviewer, setReviewer] = useState(summary.reviewed_by || "");
  const [editing, setEditing] = useState(false);

  const confirmed = summary.status === "confirmed";
  const rejected = summary.status === "rejected";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-clinical-ink">AI clinical summary</h3>
          <Badge
            className={
              confirmed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : rejected
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }
          >
            {titleCase(summary.status)}
          </Badge>
          {summary.used_llm_fallback && (
            <Badge className="border-clinical-line bg-clinical-bg text-clinical-muted">Deterministic fallback</Badge>
          )}
        </div>
        <PriorityBadge priority={summary.triage_priority} />
      </div>

      <AiDraftNotice className="mt-3" />

      <div className="mt-4">
        <Field label="Narrative">
          {editing ? (
            <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} className="min-h-[140px]" />
          ) : (
            <p className="whitespace-pre-wrap rounded-xl border border-clinical-line bg-clinical-bg/40 p-3 text-sm leading-relaxed text-clinical-ink">
              {narrative || "—"}
            </p>
          )}
        </Field>
      </div>

      <div className="mt-4">
        <StructuredHistoryView history={summary.history} />
      </div>

      <div className="mt-4">
        <Field label="Doctor notes" hint="Saved with the summary. Visible to the care team.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your notes…" />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Reviewing clinician">
          <input
            className="input"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="e.g. Dr. Rao"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Stop editing" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            loading={saving}
            onClick={() => onSaveDraft({ narrative, doctor_notes: notes })}
          >
            Save draft
          </Button>
          <Button
            variant="danger"
            loading={saving}
            disabled={!reviewer || confirmed}
            onClick={() => onReject({ reviewed_by: reviewer, doctor_notes: notes })}
          >
            Reject
          </Button>
          <Button
            loading={saving}
            disabled={!reviewer || confirmed}
            onClick={() => onConfirm({ reviewed_by: reviewer, doctor_notes: notes, accept_history: true })}
          >
            Confirm summary
          </Button>
        </div>
      </div>

      {nonEmpty(summary.retrieved_context) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-brand-700">
            Retrieved prior context ({summary.retrieved_context.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {summary.retrieved_context.map((r) => (
              <li key={r.chunk_id} className="rounded-lg border border-clinical-line bg-clinical-bg/50 p-2 text-xs text-clinical-muted">
                <span className="font-semibold text-clinical-ink">score {r.score}</span> · {r.source}
                <p className="mt-0.5 line-clamp-3">{r.text}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
