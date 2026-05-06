import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";
import {
  Badge,
  Button,
  Card,
  CopyableId,
  EmptyState,
  Modal,
  PageHeader,
  RoleBadge,
  StatCard,
  StatGrid,
  Table,
  Tabs,
  useToast,
} from "../../components/ui/index.js";

function AttendanceBar({ summary }) {
  const present = Number(summary?.present_count || 0);
  const late = Number(summary?.late_count || 0);
  const absent = Number(summary?.absent_count || 0);
  const total = present + late + absent;
  if (total === 0) {
    return (
      <div className="ui-muted" style={{ fontSize: "0.85rem" }}>
        No attendance recorded yet.
      </div>
    );
  }
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="ui-stack ui-stack--sm">
      <div className="ui-bar">
        {present > 0 ? <div className="ui-bar__seg ui-bar__seg--present" style={{ width: pct(present) }} /> : null}
        {late > 0 ? <div className="ui-bar__seg ui-bar__seg--late" style={{ width: pct(late) }} /> : null}
        {absent > 0 ? <div className="ui-bar__seg ui-bar__seg--absent" style={{ width: pct(absent) }} /> : null}
      </div>
      <div className="ui-bar__legend">
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#10b981" }} /> Present {present}
        </span>
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#f59e0b" }} /> Late {late}
        </span>
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#ef4444" }} /> Absent {absent}
        </span>
      </div>
    </div>
  );
}

export function ProgrammeManagerDashboard({ readOnly = false }) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [drilldown, setDrilldown] = useState(null);
  const [drilldownState, setDrilldownState] = useState({ loading: false, data: null });

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [s, i] = await Promise.all([
        apiFetch("/programme/summary", { token }),
        apiFetch("/institutions", { token }),
      ]);
      setSummary(s.summary);
      setInstitutions(i.institutions || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  async function openDrilldown(inst) {
    setDrilldown(inst);
    if (readOnly) {
      // Monitoring Officer can't access /institutions/:id/summary; just show the row.
      setDrilldownState({ loading: false, data: null });
      return;
    }
    setDrilldownState({ loading: true, data: null });
    try {
      const token = await getToken();
      const data = await apiFetch(`/institutions/${inst.id}/summary`, { token });
      setDrilldownState({ loading: false, data });
    } catch (err) {
      setDrilldownState({ loading: false, data: null });
      toast.error(formatApiError(err));
    }
  }

  const attendanceRate = useMemo(() => {
    if (!summary) return null;
    const total = Number(summary.total_marks || 0);
    if (total === 0) return null;
    return Math.round((Number(summary.present_count || 0) / total) * 100);
  }, [summary]);

  const tabs = [
    { key: "overview", label: "Programme overview", icon: "📊" },
    {
      key: "institutions",
      label: "Institutions",
      icon: "🏢",
      badge: institutions.length || undefined,
    },
  ];

  const role = readOnly ? "MonitoringOfficer" : "ProgrammeManager";
  const roleTitle = readOnly ? "Monitoring Officer" : "Programme Manager";

  return (
    <div className="ui-stack ui-stack--lg">
      <PageHeader
        eyebrow={`${roleTitle} workspace`}
        title="Programme overview"
        subtitle={
          readOnly
            ? "Read-only view of attendance across every institution in the programme."
            : "Cross-institution attendance summary for your region."
        }
        actions={
          <Button variant="secondary" onClick={refreshAll} loading={loading}>
            Refresh
          </Button>
        }
        badge={<RoleBadge role={role} />}
      />

      {readOnly ? (
        <div className="ui-readonly-banner">
          <span className="ui-readonly-banner__icon">🔒</span>
          You have read-only access. No create, edit, or delete actions are available.
        </div>
      ) : null}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" ? (
        <div className="ui-stack ui-stack--lg">
          <StatGrid min={150}>
            <StatCard label="Institutions" value={summary?.total_institutions ?? 0} icon="🏢" tone="info" />
            <StatCard label="Batches" value={summary?.total_batches ?? 0} icon="📚" tone="neutral" />
            <StatCard label="Sessions" value={summary?.total_sessions ?? 0} icon="🗓️" tone="neutral" />
            <StatCard label="Students" value={summary?.total_students ?? 0} icon="👨‍🎓" tone="info" />
            <StatCard
              label="Attendance rate"
              value={attendanceRate == null ? "—" : `${attendanceRate}%`}
              hint={attendanceRate == null ? "No marks yet" : "Present ÷ total marks"}
              icon="📈"
              tone="success"
            />
            <StatCard label="Present" value={summary?.present_count ?? 0} icon="✅" tone="success" />
            <StatCard label="Late" value={summary?.late_count ?? 0} icon="⏰" tone="warning" />
            <StatCard label="Absent" value={summary?.absent_count ?? 0} icon="❌" tone="danger" />
          </StatGrid>

          <Card title="Attendance breakdown" subtitle="All marks across the entire programme.">
            <AttendanceBar summary={summary} />
          </Card>
        </div>
      ) : null}

      {tab === "institutions" ? (
        <Card
          title="Institutions in this programme"
          subtitle={
            readOnly
              ? "Read-only list of institutions. Drill-down stats are available to Programme Managers."
              : "Click an institution to see its attendance summary."
          }
        >
          <Table
            columns={[
              {
                key: "name",
                label: "Institution",
                render: (i) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.name}</div>
                    <CopyableId value={i.id} />
                  </div>
                ),
              },
              {
                key: "created_at",
                label: "Created",
                render: (i) => (
                  <span className="ui-muted">
                    {i.created_at ? new Date(i.created_at).toLocaleDateString() : "—"}
                  </span>
                ),
              },
              ...(!readOnly
                ? [
                    {
                      key: "actions",
                      label: "",
                      render: (i) => (
                        <Button size="sm" variant="secondary" onClick={() => openDrilldown(i)}>
                          View summary
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={institutions}
            empty={
              <EmptyState
                title="No institutions registered"
                hint="As soon as Institution-role users set up their organisation, they'll show up here."
                icon="🏢"
              />
            }
          />
        </Card>
      ) : null}

      <Modal
        open={!!drilldown}
        title={drilldown ? `Summary — ${drilldown.name}` : "Institution summary"}
        size="lg"
        onClose={() => {
          setDrilldown(null);
          setDrilldownState({ loading: false, data: null });
        }}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setDrilldown(null);
              setDrilldownState({ loading: false, data: null });
            }}
          >
            Close
          </Button>
        }
      >
        {drilldown ? (
          drilldownState.loading ? (
            <p className="ui-muted">Loading…</p>
          ) : drilldownState.data ? (
            <div className="ui-stack">
              <StatGrid min={130}>
                <StatCard label="Batches" value={drilldownState.data.summary?.total_batches} tone="info" />
                <StatCard label="Sessions" value={drilldownState.data.summary?.total_sessions} tone="info" />
                <StatCard label="Students" value={drilldownState.data.summary?.total_students} tone="neutral" />
                <StatCard label="Marks" value={drilldownState.data.summary?.total_marks} tone="neutral" />
                <StatCard label="Present" value={drilldownState.data.summary?.present_count} tone="success" />
                <StatCard label="Late" value={drilldownState.data.summary?.late_count} tone="warning" />
                <StatCard label="Absent" value={drilldownState.data.summary?.absent_count} tone="danger" />
              </StatGrid>
              <AttendanceBar summary={drilldownState.data.summary} />
            </div>
          ) : (
            <p className="ui-muted">No data.</p>
          )
        ) : null}
      </Modal>
    </div>
  );
}
