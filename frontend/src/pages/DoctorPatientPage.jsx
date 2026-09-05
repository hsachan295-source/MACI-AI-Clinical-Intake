import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, ClipboardCheck, User } from "lucide-react";
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
  TextInput,
} from "../components/ui.jsx";
import { initials, titleCase } from "../lib/format";
import { api, ApiError } from "../lib/api";

const TABS = ["Summary", "Documents", "Timeline", "AYUSH"];

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
      right={
        <Link to="/doctor" className="btn-ghost px-2.5 py-2 text-sm">
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
          {/* Patient overview */}
          <Card className="mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-700">
                  {initials(data.overview.full_name)}
                </span>
                <div>
                  <h1 className="text-xl font-extrabold text-clinical-ink">{data.overview.full_name}</h1>
                  <p className="text-sm text-clinical-muted">
                    {[
                      data.overview.age ? `${data.overview.age} years` : null,
                      titleCase(data.overview.gender),
                      `Lang ${data.overview.preferred_language?.toUpperCase()}`,
                      data.overview.mrn ? `MRN ${data.overview.mrn}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-clinical-ink">
                    Chief complaint: <span className="font-normal">{data.overview.chief_complaint || "—"}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <PriorityBadge priority={data.triage_priority} />
                  {data.red_flag && <RedFlagPill />}
                  <Badge className="border-clinical-line bg-clinical-bg text-clinical-muted">
                    {titleCase(data.session_status)}
                  </Badge>
                </div>
                {data.session_status === "reviewed" ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Reviewed
                  </span>
                ) : (
                  <Button onClick={() => setReviewOpen(true)}>
                    <ClipboardCheck className="h-4 w-4" /> Mark as reviewed
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-3 inline-flex flex-wrap rounded-xl border border-clinical-line bg-white p-0.5">
                {TABS.map((tk) => (
                  <button
                    key={tk}
                    onClick={() => setTab(tk)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                      tab === tk ? "bg-brand-600 text-white" : "text-clinical-muted hover:text-clinical-ink"
                    }`}
                  >
                    {tk}
                  </button>
                ))}
              </div>

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
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-clinical-muted">
                      AYUSH / Ayurveda assessment
                    </h3>
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {Object.entries(data.ayush_assessment)
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[130px_1fr] gap-2 text-sm">
                            <dt className="font-semibold text-clinical-muted">{titleCase(k)}</dt>
                            <dd className="text-clinical-ink">{String(v)}</dd>
                          </div>
                        ))}
                    </dl>
                  </Card>
                ) : (
                  <EmptyState title="No AYUSH assessment" subtitle="This intake used the general clinical mode." />
                ))}
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              <AttentionPoints
                points={summary?.attention_points}
                redFlags={summary?.red_flags?.length ? summary.red_flags : data.summary?.red_flags}
              />
              <Card className="p-4 text-xs text-clinical-muted">
                <p className="font-semibold text-clinical-ink">Session</p>
                <p className="mt-1">ID: {String(data.session_id).slice(0, 8)}…</p>
                <p>Transcript: {data.transcript_available ? "captured" : "none"}</p>
                {summary?.model_name && <p>Model: {summary.model_name}</p>}
              </Card>
            </div>
          </div>
        </>
      )}

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Mark patient as reviewed"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!reviewer.trim()} onClick={markReviewed}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-clinical-muted">
          This moves the patient out of the active queue and acknowledges any open alerts.
        </p>
        <div className="mt-3">
          <label className="label">Your name</label>
          <TextInput value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. Dr. Rao" autoFocus />
        </div>
      </Modal>
    </DoctorShell>
  );
}
