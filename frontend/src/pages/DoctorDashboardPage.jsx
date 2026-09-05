import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Users } from "lucide-react";
import { DoctorShell } from "../components/layout.jsx";
import { AnalyticsCharts, QueueTable } from "../components/doctor.jsx";
import { Button, ErrorState, StatCard } from "../components/ui.jsx";
import { api, ApiError } from "../lib/api";

const PRIORITY_FILTERS = [
  { value: "", label: "All priorities" },
  { value: "emergency", label: "Emergency" },
  { value: "urgent", label: "Urgent" },
  { value: "standard", label: "Standard" },
  { value: "routine", label: "Routine" },
];

const POLL_MS = 15000;

export default function DoctorDashboardPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "analytics" ? "analytics" : "queue";

  const [queue, setQueue] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [priority, setPriority] = useState("");
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(
    async ({ silent } = {}) => {
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const [q, a] = await Promise.all([
          api.doctorQueue({ priority: priority || undefined, include_reviewed: includeReviewed }),
          api.doctorAnalytics(),
        ]);
        setQueue(q);
        setAnalytics(a);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load the dashboard");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [priority, includeReviewed]
  );

  useEffect(() => {
    load();
    timer.current = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  const emergencies = queue?.items?.filter((i) => i.triage_priority === "emergency" || i.red_flag).length || 0;
  useEffect(() => {
    if (emergencies > 0 && tab === "queue") {
      toast(() => (
        <span className="flex items-center gap-2 text-rose-700">
          <AlertTriangle className="h-4 w-4" />
          {emergencies} high-priority patient{emergencies > 1 ? "s" : ""} in the queue
        </span>
      ), { id: "hp-alert" });
    }
  }, [emergencies, tab]);

  const setTab = (next) => {
    const p = new URLSearchParams(params);
    if (next === "analytics") p.set("tab", "analytics");
    else p.delete("tab");
    setParams(p, { replace: true });
  };

  return (
    <DoctorShell
      right={
        <Button variant="ghost" onClick={() => load()} className="px-2.5" aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Patients today" value={analytics?.patients_today ?? "—"} icon={Users} />
        <StatCard label="Waiting" value={analytics?.waiting ?? "—"} icon={Clock} tone="amber" />
        <StatCard label="High priority" value={analytics?.high_priority ?? "—"} icon={AlertTriangle} tone="rose" />
        <StatCard label="Completed intake" value={analytics?.completed_intake ?? "—"} icon={CheckCircle2} tone="emerald" />
        <StatCard
          label="Avg intake time"
          value={analytics ? `${analytics.average_intake_minutes} min` : "—"}
          sub="submitted − created"
          icon={Activity}
        />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-clinical-line bg-white p-0.5">
          {["queue", "analytics"].map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
                tab === tk ? "bg-brand-600 text-white" : "text-clinical-muted hover:text-clinical-ink"
              }`}
            >
              {tk}
            </button>
          ))}
        </div>

        {tab === "queue" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-clinical-muted">
              <input
                type="checkbox"
                checked={includeReviewed}
                onChange={(e) => setIncludeReviewed(e.target.checked)}
                className="h-4 w-4 rounded border-clinical-line text-brand-600"
              />
              Show reviewed
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="input h-9 w-auto py-1 text-sm"
            >
              {PRIORITY_FILTERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : tab === "queue" ? (
        <QueueTable items={queue?.items} loading={loading && !queue} />
      ) : (
        <AnalyticsCharts analytics={analytics} />
      )}
    </DoctorShell>
  );
}
