import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Search,
  Stethoscope,
} from "lucide-react";
import { initials, nonEmpty, titleCase } from "../lib/format";
import { useTheme } from "../lib/theme.jsx";
import { listItem, staggerParent } from "../lib/motion.jsx";
import {
  AiDraftNotice,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PriorityBadge,
  RedFlagPill,
  Select,
  Textarea,
  cx,
} from "./ui.jsx";
import { StructuredHistoryView } from "./intake.jsx";

/* --------------------------------------------------------------------- */
/* Theme-aware chart palette                                             */
/* --------------------------------------------------------------------- */
function useChartTheme() {
  const { resolved } = useTheme();
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => `rgb(${cs.getPropertyValue(n).trim() || "0 0 0"})`;
    return {
      grid: v("--border"),
      axis: v("--text-muted"),
      primary: v("--primary"),
      accent: v("--accent"),
      tooltip: {
        background: v("--surface-elevated"),
        border: `1px solid ${v("--border")}`,
        borderRadius: 12,
        color: v("--text-primary"),
        fontSize: 12,
        boxShadow: "0 20px 50px -12px rgb(0 0 0 / 0.25)",
      },
      palette: [v("--primary"), v("--accent"), "rgb(139 92 246)", "rgb(16 185 129)", v("--warning"), v("--critical")],
      key: resolved,
    };
  }, [resolved]);
}

/* --------------------------------------------------------------------- */
/* Patient queue                                                          */
/* --------------------------------------------------------------------- */
const SORTS = [
  { value: "priority", label: "Priority" },
  { value: "waiting", label: "Longest waiting" },
  { value: "completion", label: "Intake completion" },
  { value: "name", label: "Name" },
];
const PRIORITY_RANK = { emergency: 0, urgent: 1, standard: 2, routine: 3 };

export function QueueTable({ items, loading }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("priority");
  const [dir, setDir] = useState("asc");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    let list = [...(items || [])];
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (i) =>
          i.patient_name?.toLowerCase().includes(needle) ||
          i.chief_complaint?.toLowerCase().includes(needle)
      );
    }
    if (status !== "all") list = list.filter((i) => i.status === status);
    list.sort((a, b) => {
      let d = 0;
      if (sort === "priority") d = (PRIORITY_RANK[a.triage_priority] ?? 9) - (PRIORITY_RANK[b.triage_priority] ?? 9);
      else if (sort === "waiting") d = (b.waiting_minutes || 0) - (a.waiting_minutes || 0);
      else if (sort === "completion") d = (b.completion_pct || 0) - (a.completion_pct || 0);
      else if (sort === "name") d = (a.patient_name || "").localeCompare(b.patient_name || "");
      return dir === "asc" ? d : -d;
    });
    return list;
  }, [items, q, sort, dir, status]);

  const statusOptions = useMemo(() => {
    const set = new Set((items || []).map((i) => i.status).filter(Boolean));
    return [{ value: "all", label: "All statuses" }, ...[...set].map((s) => ({ value: s, label: titleCase(s) }))];
  }, [items]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient or complaint…"
            className="input h-9 pl-9 text-sm"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={statusOptions}
          className="h-9 w-auto py-1 text-sm"
        />
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={SORTS}
          className="h-9 w-auto py-1 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          aria-label="Toggle sort direction"
        >
          {dir === "asc" ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
        </Button>
      </div>

      {!nonEmpty(rows) ? (
        <EmptyState
          icon={ClipboardList}
          title={q || status !== "all" ? "No matching patients" : "No patients waiting"}
          subtitle="Submitted intakes appear here, highest priority first."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1.7fr_1.5fr_0.9fr_1fr_0.8fr_auto] gap-3 border-b border-border bg-surface/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-fg-subtle lg:grid">
            <span>Patient</span>
            <span>Chief complaint</span>
            <span>Priority</span>
            <span>Intake</span>
            <span>Waiting</span>
            <span />
          </div>
          <motion.ul variants={staggerParent(0.03)} initial="hidden" animate="show" className="divide-y divide-border">
            {rows.map((it) => (
              <motion.li key={it.session_id} variants={listItem}>
                <Link
                  to={`/doctor/patients/${it.patient_id}?session=${it.session_id}`}
                  className={cx(
                    "group grid gap-2 px-4 py-3.5 transition hover:bg-primary/5 lg:grid-cols-[1.7fr_1.5fr_0.9fr_1fr_0.8fr_auto] lg:items-center lg:gap-3",
                    (it.triage_priority === "emergency" || it.red_flag) && "bg-critical/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {(it.triage_priority === "emergency" || it.red_flag) && (
                      <span className="h-8 w-1 shrink-0 rounded-full bg-critical" />
                    )}
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(it.patient_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{it.patient_name}</p>
                      <p className="truncate text-xs text-fg-subtle">
                        {[it.age ? `${it.age}y` : null, titleCase(it.gender), it.language?.toUpperCase()]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <p className="truncate text-sm text-fg-muted">{it.chief_complaint || "—"}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={it.triage_priority} />
                    {it.red_flag && <RedFlagPill />}
                  </div>
                  <div>
                    <div className="h-1.5 w-full max-w-[7rem] overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary-sheen"
                        style={{ width: `${it.completion_pct || 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-fg-subtle">
                      {it.completion_pct || 0}% · {titleCase(it.status)}
                    </p>
                  </div>
                  <p className="text-xs text-fg-muted">
                    {it.waiting_minutes < 60
                      ? `${it.waiting_minutes} min`
                      : `${Math.round(it.waiting_minutes / 60)} hr`}
                  </p>
                  <ChevronRight className="hidden h-4 w-4 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-primary lg:block" />
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Analytics                                                              */
/* --------------------------------------------------------------------- */
function ChartCard({ title, children, span }) {
  return (
    <Card className={cx("p-4", span && "lg:col-span-2")}>
      <p className="mb-3 text-sm font-bold text-fg">{title}</p>
      {children}
    </Card>
  );
}
function EmptyChart() {
  return <div className="grid h-[240px] place-items-center text-sm text-fg-subtle">Not enough data yet</div>;
}

export function AnalyticsCharts({ analytics }) {
  const T = useChartTheme();
  const complaint = (analytics?.by_complaint_category || []).filter((b) => b.value > 0);
  const priority = (analytics?.by_priority || []).filter((b) => b.value > 0);
  const activity = analytics?.intake_activity_by_hour || [];

  return (
    <motion.div
      key={T.key}
      variants={staggerParent(0.08)}
      initial="hidden"
      animate="show"
      className="grid gap-4 lg:grid-cols-2"
    >
      <motion.div variants={listItem}>
        <ChartCard title="Patients by complaint category">
          {complaint.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={complaint} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={T.grid} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: T.axis }} stroke={T.grid} />
                <YAxis type="category" dataKey="label" width={132} tick={{ fontSize: 12, fill: T.axis }} stroke={T.grid} />
                <RTooltip cursor={{ fill: T.grid, opacity: 0.3 }} contentStyle={T.tooltip} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={T.primary} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </motion.div>

      <motion.div variants={listItem}>
        <ChartCard title="Priority distribution">
          {priority.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={priority} dataKey="value" nameKey="label" outerRadius={92} innerRadius={52} paddingAngle={2} label>
                  {priority.map((entry, i) => (
                    <Cell key={entry.label} fill={T.palette[i % T.palette.length]} />
                  ))}
                </Pie>
                <RTooltip contentStyle={T.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </motion.div>

      <motion.div variants={listItem} className="lg:col-span-2">
        <ChartCard title="Intake activity by hour" span>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activity} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.axis }} interval={1} stroke={T.grid} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: T.axis }} width={28} stroke={T.grid} />
              <RTooltip cursor={{ fill: T.grid, opacity: 0.3 }} contentStyle={T.tooltip} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={T.accent} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </motion.div>
    </motion.div>
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
    <motion.ol
      variants={staggerParent(0.06)}
      initial="hidden"
      animate="show"
      className="relative ml-3 border-l-2 border-border"
    >
      {events.map((e, i) => {
        const Icon = TL_ICON[e.category] || FileText;
        const isVisit = e.category === "visit";
        return (
          <motion.li key={i} variants={listItem} className="mb-5 ml-6">
            <span
              className={cx(
                "absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full border-2 border-bg",
                isVisit ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-bold text-fg">{e.title}</p>
              <span className="text-xs font-medium text-fg-subtle">{e.date}</span>
            </div>
            {e.detail && <p className="text-sm text-fg-muted">{e.detail}</p>}
            {e.source && e.source !== "current-visit" && (
              <p className="mt-0.5 text-[11px] text-fg-subtle">from {e.source}</p>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-elevated text-fg-muted">
                  <FileText className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-fg">{d.filename}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone="neutral">{titleCase(d.document_type)}</Badge>
                {d.corrected_by_user && <Badge tone="success">Corrected</Badge>}
              </div>
            </div>
            {d.error && <p className="mt-2 text-xs text-danger">{d.error}</p>}
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
                <summary className="cursor-pointer text-xs font-semibold text-primary">Show raw OCR text</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface/60 p-3 text-[11px] text-fg-subtle">
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
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">{title}</p>
      {list.length ? (
        <ul className="mt-1 space-y-0.5 text-sm text-fg">
          {list.map((x, i) => (
            <li key={i}>• {x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-fg-subtle">None</p>
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
        <Card className="border-critical/35 bg-critical/8 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-critical">
            <AlertTriangle className="h-4 w-4" /> Red flags
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-fg">
            {redFlags.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-fg-subtle">
            Deterministic + AI screening. Not a diagnosis — clinician assessment required.
          </p>
        </Card>
      )}
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-fg">
          <ClipboardList className="h-4 w-4 text-primary" /> AI attention points
        </p>
        {nonEmpty(points) ? (
          <ul className="mt-1.5 space-y-1 text-sm text-fg-muted">
            {points.map((p, i) => (
              <li key={i}>• {p}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-fg-subtle">None suggested.</p>
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
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-bold text-fg">AI clinical summary</h3>
          <Badge tone={confirmed ? "success" : rejected ? "danger" : "warning"}>{titleCase(summary.status)}</Badge>
          {summary.used_llm_fallback && <Badge tone="neutral">Deterministic fallback</Badge>}
        </div>
        <PriorityBadge priority={summary.triage_priority} />
      </div>

      <AiDraftNotice className="mt-3" />

      <div className="mt-4">
        <Field label="Narrative">
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} className="min-h-[150px]" />
              </motion.div>
            ) : (
              <motion.p
                key="view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-pre-wrap rounded-xl border border-border bg-surface/50 p-3.5 text-sm leading-relaxed text-fg"
              >
                {narrative || "—"}
              </motion.p>
            )}
          </AnimatePresence>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Reviewing clinician">
          <input className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. Dr. Rao" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Stop editing" : "Edit"}
          </Button>
          <Button size="sm" variant="ghost" loading={saving} onClick={() => onSaveDraft({ narrative, doctor_notes: notes })}>
            Save draft
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={saving}
            disabled={!reviewer || confirmed}
            onClick={() => onReject({ reviewed_by: reviewer, doctor_notes: notes })}
          >
            Reject
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!reviewer || confirmed}
            onClick={() => onConfirm({ reviewed_by: reviewer, doctor_notes: notes, accept_history: true })}
          >
            Confirm summary
          </Button>
        </div>
      </div>

      {nonEmpty(summary.retrieved_context) && (
        <details className="mt-4 rounded-xl border border-border bg-surface/50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-primary">
            Retrieved prior context ({summary.retrieved_context.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {summary.retrieved_context.map((r) => (
              <li key={r.chunk_id} className="rounded-lg border border-border bg-card p-2 text-xs text-fg-muted">
                <span className="font-semibold text-fg">score {r.score}</span> · {r.source}
                <p className="mt-0.5 line-clamp-3">{r.text}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
