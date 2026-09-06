import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Leaf, User } from "lucide-react";
import { DoctorShell } from "../components/layout.jsx";
import {
  AttentionPoints,
  DocumentIntelligence,
  EditableSummary,
  TimelineView,
} from "../components/doctor.jsx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PriorityBadge,
  RedFlagPill,
  SkeletonRows,
  Tabs,
  TextInput,
  cx,
} from "../components/ui.jsx";
import { initials, titleCase } from "../lib/format";
import { fadeUp } from "../lib/motion.jsx";
import { api, ApiError } from "../lib/api";

const TABS = [
  { value: "Summary", label: "Clinical Summary" },
  { value: "Documents", label: "Documents" },
  { value: "Timeline", label: "Timeline" },
  { value: "AYUSH", label: "AYUSH" },
];

export default function DoctorPatientPage() {
  const { patientId } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get("session") || undefined;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("Summary");
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewer, setReviewer] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.doctorPatientSummary(patientId, sessionId);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this patient");
    } finally {
      setLoading(false);
    }
  }, [patientId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;

  async function saveDraft(patch) {
    if (!summary) return;
    setSaving(true);
    try {
      await api.patchSummary(summary.id, patch);
      toast.success("Draft saved");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  async function confirmSummary(body) {
    setSaving(true);
    try {
      await api.confirmSummary(summary.id, body);
      toast.success("Summary confirmed");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not confirm");
    } finally {
      setSaving(false);
    }
  }
  async function rejectSummary(body) {
    setSaving(true);
    try {
      await api.rejectSummary(summary.id, body);
      toast("Summary marked rejected", { icon: "↩️" });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not reject");
    } finally {
      setSaving(false);
    }
  }
  async function markReviewed() {
    if (!reviewer.trim()) return;
    setSaving(true);
    try {
      await api.markReviewed(data.session_id, { reviewed_by: reviewer });
      toast.success("Patient marked as reviewed");
      setReviewOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DoctorShell
      title="Patient workspace"
      right={
        <Link to="/doctor" className="btn-ghost h-9 px-2.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Queue
        </Link>
      }
    >
      {loading && !data ? (
        <Card className="p-6">
          <SkeletonRows rows={6} />
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {/* Sticky patient header */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="sticky top-16 z-20 -mx-4 mb-4 px-4 lg:-mx-6 lg:px-6">
            <Card className="flex flex-wrap items-start justify-between gap-4 border-border-strong bg-card/80 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">
                  {initials(data.overview.full_name)}
                </span>
                <div>
                  <h1 className="font-display text-xl font-extrabold tracking-tight text-fg">{data.overview.full_name}</h1>
                  <p className="text-sm text-fg-muted">
                    {[
                      data.overview.age ? `${data.overview.age} years` : null,
                      titleCase(data.overview.gender),
                      `Lang ${data.overview.preferred_language?.toUpperCase()}`,
                      data.overview.mrn ? `MRN ${data.overview.mrn}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-sm text-fg">
                    <span className="font-medium text-fg-muted">Chief complaint:</span>{" "}
                    {data.overview.chief_complaint || "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <PriorityBadge priority={data.triage_priority} />
                  {data.red_flag && <RedFlagPill />}
                  <Badge tone="neutral">{titleCase(data.session_status)}</Badge>
                </div>
                {data.session_status === "reviewed" ? (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" /> Reviewed
                  </span>
                ) : (
                  <Button size="sm" onClick={() => setReviewOpen(true)}>
                    <ClipboardCheck className="h-4 w-4" /> Mark as reviewed
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div>
              <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-3" />

              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                {tab === "Summary" &&
                  (summary ? (
                    <EditableSummary
                      key={`${summary.id}:${summary.status}:${summary.updated_at}`}
                      summary={summary}
                      saving={saving}
                      onSaveDraft={saveDraft}
                      onConfirm={confirmSummary}
                      onReject={rejectSummary}
                    />
                  ) : (
                    <EmptyState
                      icon={User}
                      title="No summary generated yet"
                      subtitle="The patient has not completed the AI review step."
                    />
                  ))}

                {tab === "Documents" && <DocumentIntelligence documents={data.documents} />}

                {tab === "Timeline" && (
                  <Card className="p-5">
                    <TimelineView events={data.timeline} />
                  </Card>
                )}

                {tab === "AYUSH" &&
                  (data.ayush_assessment ? (
                    <Card className="p-5">
                      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg-subtle">
                        <Leaf className="h-4 w-4 text-success" /> AYUSH / Ayurveda assessment
                      </h3>
                      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        {Object.entries(data.ayush_assessment)
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k} className="grid grid-cols-[130px_1fr] gap-2 text-sm">
                              <dt className="font-semibold text-fg-subtle">{titleCase(k)}</dt>
                              <dd className="text-fg">{String(v)}</dd>
                            </div>
                          ))}
                      </dl>
                    </Card>
                  ) : (
                    <EmptyState title="No AYUSH assessment" subtitle="This intake used the general clinical mode." />
                  ))}
              </motion.div>
            </div>

            <aside className="space-y-4">
              <AttentionPoints
                points={summary?.attention_points}
                redFlags={summary?.red_flags?.length ? summary.red_flags : data.summary?.red_flags}
              />
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Session</p>
                <dl className="mt-2 space-y-1 text-xs text-fg-muted">
                  <div className="flex justify-between gap-2">
                    <dt>ID</dt>
                    <dd className={cx("font-mono text-fg")}>{String(data.session_id).slice(0, 8)}…</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Transcript</dt>
                    <dd className="text-fg">{data.transcript_available ? "Captured" : "None"}</dd>
                  </div>
                  {summary?.model_name && (
                    <div className="flex justify-between gap-2">
                      <dt>Model</dt>
                      <dd className="text-fg">{summary.model_name}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            </aside>
          </div>
        </>
      )}

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Mark patient as reviewed"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} disabled={!reviewer.trim()} onClick={markReviewed}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          This moves the patient out of the active queue and acknowledges any open alerts.
        </p>
        <div className="mt-3">
          <label className="label" htmlFor="reviewer-name">
            Your name
          </label>
          <TextInput
            id="reviewer-name"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="e.g. Dr. Rao"
            autoFocus
          />
        </div>
      </Modal>
    </DoctorShell>
  );
}
