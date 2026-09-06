import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Users } from "lucide-react";
import { DoctorShell } from "../components/layout.jsx";
import { AnalyticsCharts, QueueTable } from "../components/doctor.jsx";
import { Button, ErrorState, PageHeader, StatCard, Tabs } from "../components/ui.jsx";
import { staggerParent, listItem } from "../lib/motion.jsx";
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
      toast(
        () => (
          <span className="flex items-center gap-2 font-semibold text-critical">
            <AlertTriangle className="h-4 w-4" />
            {emergencies} high-priority patient{emergencies > 1 ? "s" : ""} in the queue
          </span>
        ),
        { id: "hp-alert" }
      );
    }
  }, [emergencies, tab]);

  const setTab = (next) => {
    const p = new URLSearchParams(params);
    if (next === "analytics") p.set("tab", "analytics");
    else p.delete("tab");
    setParams(p, { replace: true });
  };

  const hourly = analytics?.intake_activity_by_hour?.map((b) => b.value) || [];

  return (
    <DoctorShell
      right={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => load()}
          className="px-2.5"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      <PageHeader
        icon={Users}
        title="Overview"
        subtitle="Live patient queue and clinical analytics · auto-refreshing"
      />

      <motion.div
        variants={staggerParent(0.06)}
        initial="hidden"
        animate="show"
        className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {[
          { label: "Patients today", numeric: analytics?.patients_today, icon: Users, tone: "primary", spark: hourly },
          { label: "Waiting", numeric: analytics?.waiting, icon: Clock, tone: "warning" },
          { label: "High priority", numeric: analytics?.high_priority, icon: AlertTriangle, tone: "danger" },
          { label: "Completed intake", numeric: analytics?.completed_intake, icon: CheckCircle2, tone: "success" },
          {
            label: "Avg intake time",
            numeric: analytics?.average_intake_minutes,
            decimals: analytics?.average_intake_minutes % 1 ? 1 : 0,
            suffix: " min",
            sub: "submitted − created",
            icon: Activity,
            tone: "accent",
          },
        ].map((s) => (
          <motion.div key={s.label} variants={listItem}>
            <StatCard {...s} loading={!analytics} />
          </motion.div>
        ))}
      </motion.div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { value: "queue", label: "Patient Queue" },
            { value: "analytics", label: "Analytics" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "queue" && (
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-fg-muted">
              <input
                type="checkbox"
                checked={includeReviewed}
                onChange={(e) => setIncludeReviewed(e.target.checked)}
                className="h-4 w-4 rounded border-border-strong text-primary focus:ring-ring/50"
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
