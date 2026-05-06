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
  Field,
  Input,
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
  const total = Number(summary?.total_marks || 0);
  const present = Number(summary?.present_count || 0);
  const late = Number(summary?.late_count || 0);
  const absent = Number(summary?.absent_count || 0);
  const sessions = Number(summary?.total_sessions || 0);
  const students = Number(summary?.total_students || 0);
  const expected = sessions * students;
  const unmarked = Math.max(0, expected - total);
  const denom = Math.max(1, expected || total);
  const pct = (n) => `${(n / denom) * 100}%`;

  return (
    <div className="ui-stack ui-stack--sm">
      <div className="ui-bar" aria-label="Attendance distribution">
        {present > 0 ? <div className="ui-bar__seg ui-bar__seg--present" style={{ width: pct(present) }} /> : null}
        {late > 0 ? <div className="ui-bar__seg ui-bar__seg--late" style={{ width: pct(late) }} /> : null}
        {absent > 0 ? <div className="ui-bar__seg ui-bar__seg--absent" style={{ width: pct(absent) }} /> : null}
        {unmarked > 0 ? <div className="ui-bar__seg ui-bar__seg--unmarked" style={{ width: pct(unmarked) }} /> : null}
      </div>
      <div className="ui-bar__legend">
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#10b981" }} />
          Present {present}
        </span>
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#f59e0b" }} />
          Late {late}
        </span>
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#ef4444" }} />
          Absent {absent}
        </span>
        <span className="ui-bar__legend-item">
          <span className="ui-bar__legend-swatch" style={{ background: "#cbd5e1" }} />
          Not marked {unmarked}
        </span>
      </div>
    </div>
  );
}

export function InstitutionDashboard({ profile, institution }) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [linkedProfile, setLinkedProfile] = useState(profile);
  const [tab, setTab] = useState("organization");
  const [setupName, setSetupName] = useState(profile?.name ? `${profile.name}'s Institute` : "");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [details, setDetails] = useState({ loading: false, data: null, error: null });
  const [busy, setBusy] = useState(false);
  const [summaryByBatch, setSummaryByBatch] = useState({});
  const [summaryFor, setSummaryFor] = useState(null);
  const [batchModal, setBatchModal] = useState(false);
  const [batchName, setBatchName] = useState("");

  const orgId = linkedProfile?.institution_id || null;

  const refreshDetails = useCallback(async () => {
    if (!orgId) {
      setDetails({ loading: false, data: null, error: null });
      return;
    }
    setDetails((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getToken();
      const data = await apiFetch(`/institutions/${orgId}/details`, { token });
      setDetails({ loading: false, data, error: null });
    } catch (e) {
      setDetails({ loading: false, data: null, error: e });
    }
  }, [orgId, getToken]);

  useEffect(() => {
    refreshDetails();
  }, [refreshDetails]);

  async function setupOrganization(e) {
    e?.preventDefault?.();
    const name = setupName.trim();
    if (name.length < 2) {
      toast.error("Please enter at least 2 characters for the organisation name.");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const data = await apiFetch("/institutions", {
        token,
        method: "POST",
        body: { name },
      });
      setLinkedProfile(data.user || linkedProfile);
      toast.success(`Organisation "${data.institution.name}" is set up.`);
      setTab("organization");
      await refreshDetails();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function renameOrganization(e) {
    e?.preventDefault?.();
    if (!orgId) return;
    const name = renameValue.trim();
    if (name.length < 2) {
      toast.error("Name is too short.");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      await apiFetch(`/institutions/${orgId}`, {
        token,
        method: "PATCH",
        body: { name },
      });
      toast.success("Organisation renamed.");
      setRenameOpen(false);
      await refreshDetails();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadBatchSummary(batchId) {
    setSummaryFor(batchId);
    try {
      const token = await getToken();
      const data = await apiFetch(`/batches/${batchId}/summary`, { token });
      setSummaryByBatch((m) => ({ ...m, [batchId]: data.summary }));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }

  async function createBatch(e) {
    e?.preventDefault?.();
    const name = batchName.trim();
    if (!name) return;
    if (!orgId) {
      toast.error("Set up your organisation first.");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const res = await apiFetch("/batches", {
        token,
        method: "POST",
        body: { name },
      });
      const orgName =
        res.institution?.name || details.data?.institution?.name || "your institution";
      toast.success(`Batch "${res.batch.name}" created under ${orgName}.`);
      setBatchName("");
      setBatchModal(false);
      await refreshDetails();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const data = details.data;
  const batches = data?.batches || [];
  const trainers = data?.trainers || [];
  const sessions = data?.sessions || [];
  const summaryForBatch = summaryFor ? summaryByBatch[summaryFor] : null;
  const summaryBatchObj = summaryFor ? batches.find((b) => String(b.id) === String(summaryFor)) : null;

  // Aggregate stats across batches (fast / approximate; uses fetched summaries when available).
  const aggregate = useMemo(() => {
    const stats = { sessions: sessions.length, batches: batches.length, trainers: trainers.length };
    return stats;
  }, [batches.length, sessions.length, trainers.length]);

  // ---- ORG NOT YET SET UP ----
  if (!orgId) {
    return (
      <div className="ui-stack ui-stack--lg">
        <PageHeader
          eyebrow="Institution workspace"
          title="Welcome — set up your organisation"
          subtitle="Give your institution a name. We'll create it and assign it a unique ID you can share with your trainers and programme manager."
          badge={<RoleBadge role="Institution" />}
        />
        <Card
          title="Set up your organisation"
          subtitle="This is required before you can manage batches, trainers, and attendance."
          icon="🏢"
        >
          <form onSubmit={setupOrganization} className="ui-stack">
            <Field
              label="Organisation name"
              hint="Example: Karnataka State Skill Centre, Coimbatore Polytechnic, Pune ITI."
              required
            >
              <Input
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="Your institute or skill centre name"
                autoFocus
              />
            </Field>
            <div className="ui-form-actions">
              <Button type="submit" loading={busy} disabled={!setupName.trim()}>
                Create organisation
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // ---- ORG EXISTS ----
  const tabs = [
    { key: "organization", label: "Organisation", icon: "🏢" },
    { key: "batches", label: "Batches", icon: "📚", badge: batches.length || undefined },
    { key: "trainers", label: "Trainers", icon: "👥", badge: trainers.length || undefined },
    { key: "sessions", label: "Sessions", icon: "🗓️", badge: sessions.length || undefined },
  ];

  return (
    <div className="ui-stack ui-stack--lg">
      <PageHeader
        eyebrow="Institution workspace"
        title={data?.institution?.name || "Institution"}
        subtitle="Manage your batches and trainers, and track attendance summaries across your organisation."
        actions={
          <>
            <Button variant="secondary" onClick={refreshDetails} loading={details.loading}>
              Refresh
            </Button>
          </>
        }
        badge={<RoleBadge role="Institution" />}
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {details.error ? (
        <Card>
          <p style={{ color: "var(--sb-danger)", margin: 0 }}>{formatApiError(details.error)}</p>
        </Card>
      ) : null}

      {tab === "organization" ? (
        <div className="ui-grid-2">
          <Card title="Your organisation" subtitle="Display name and unique ID assigned when you set up." icon="🏷️">
            <dl className="ui-detail">
              <dt>Name</dt>
              <dd style={{ fontWeight: 600 }}>{data?.institution?.name || "—"}</dd>
              <dt>ID</dt>
              <dd>
                <CopyableId value={orgId} />
              </dd>
              <dt>Created</dt>
              <dd className="ui-muted">
                {data?.institution?.created_at
                  ? new Date(data.institution.created_at).toLocaleString()
                  : "—"}
              </dd>
            </dl>
            <div className="ui-form-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setRenameValue(data?.institution?.name || "");
                  setRenameOpen(true);
                }}
              >
                Rename
              </Button>
            </div>
          </Card>

          <Card title="At a glance" subtitle="Live counts for your institution." icon="📊">
            <StatGrid min={140}>
              <StatCard label="Batches" value={aggregate.batches} icon="📚" tone="info" />
              <StatCard label="Trainers" value={aggregate.trainers} icon="👥" tone="success" />
              <StatCard label="Sessions" value={aggregate.sessions} icon="🗓️" tone="warning" />
            </StatGrid>
          </Card>
        </div>
      ) : null}

      {tab === "batches" ? (
        <div className="ui-stack">
          <Card
            title="Batches under your institution"
            subtitle="Every batch belongs to your organisation. Click a batch to view its attendance summary."
            actions={<Button size="sm" onClick={() => setBatchModal(true)}>+ New batch</Button>}
          >
            <Table
              columns={[
                {
                  key: "name",
                  label: "Batch",
                  render: (b) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <CopyableId value={b.id} />
                    </div>
                  ),
                },
                {
                  key: "sessions",
                  label: "Sessions",
                  render: (b) =>
                    sessions.filter((s) => String(s.batch_id) === String(b.id)).length,
                },
                {
                  key: "created_at",
                  label: "Created",
                  render: (b) => (
                    <span className="ui-muted">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  render: (b) => (
                    <Button size="sm" variant="secondary" onClick={() => loadBatchSummary(b.id)}>
                      View summary
                    </Button>
                  ),
                },
              ]}
              rows={batches}
              empty={
                <EmptyState
                  title="No batches yet"
                  hint="Create the first batch under your institution. Batches must always belong to an organisation."
                  icon="📚"
                  action={<Button onClick={() => setBatchModal(true)}>+ Create your first batch</Button>}
                />
              }
            />
          </Card>
          <Modal
            open={!!summaryFor}
            title={summaryBatchObj ? `Summary — ${summaryBatchObj.name}` : "Batch summary"}
            onClose={() => setSummaryFor(null)}
            size="lg"
            footer={
              <Button variant="secondary" onClick={() => setSummaryFor(null)}>
                Close
              </Button>
            }
          >
            {!summaryForBatch ? (
              <p className="ui-muted">Loading…</p>
            ) : (
              <>
                <StatGrid min={130}>
                  <StatCard label="Sessions" value={summaryForBatch.total_sessions} tone="info" />
                  <StatCard label="Students" value={summaryForBatch.total_students} tone="info" />
                  <StatCard label="Marks" value={summaryForBatch.total_marks} tone="neutral" />
                  <StatCard label="Present" value={summaryForBatch.present_count} tone="success" />
                  <StatCard label="Late" value={summaryForBatch.late_count} tone="warning" />
                  <StatCard label="Absent" value={summaryForBatch.absent_count} tone="danger" />
                </StatGrid>
                <div style={{ marginTop: "1rem" }}>
                  <AttendanceBar summary={summaryForBatch} />
                </div>
              </>
            )}
          </Modal>
        </div>
      ) : null}

      {tab === "trainers" ? (
        <Card title="Trainers in your institution" subtitle="Trainers attached to your organisation can create batches and sessions.">
          <Table
            columns={[
              {
                key: "name",
                label: "Name",
                render: (t) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name || "Trainer"}</div>
                    <span className="ui-muted" style={{ fontSize: "0.8rem" }}>{t.email || "—"}</span>
                  </div>
                ),
              },
              {
                key: "id",
                label: "ID",
                render: (t) => <CopyableId value={t.id} />,
              },
              {
                key: "created_at",
                label: "Joined",
                render: (t) => (
                  <span className="ui-muted">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                  </span>
                ),
              },
            ]}
            rows={trainers}
            empty={
              <EmptyState
                title="No trainers yet"
                hint="A trainer is attached to your institution automatically the first time they sign in (or you can ask them to share their dashboard with their team)."
                icon="👥"
              />
            }
          />
        </Card>
      ) : null}

      {tab === "sessions" ? (
        <Card title="Sessions across your institution" subtitle="Aggregated from every batch you manage.">
          <Table
            columns={[
              {
                key: "title",
                label: "Session",
                render: (s) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.title || "Session"}</div>
                    <span className="ui-muted" style={{ fontSize: "0.8rem" }}>
                      Batch: {s.batch_name || "—"}
                    </span>
                  </div>
                ),
              },
              {
                key: "date",
                label: "When",
                render: (s) => (
                  <div>
                    <div>{String(s.date).slice(0, 10)}</div>
                    <span className="ui-muted" style={{ fontSize: "0.8rem" }}>
                      {String(s.start_time || "").slice(0, 5)}–{String(s.end_time || "").slice(0, 5)}
                    </span>
                  </div>
                ),
              },
              {
                key: "id",
                label: "Session ID",
                render: (s) => <CopyableId value={s.id} />,
              },
            ]}
            rows={sessions}
            empty={
              <EmptyState
                title="No sessions scheduled"
                hint="Trainers schedule sessions for their batches. They'll appear here as soon as they do."
                icon="🗓️"
              />
            }
          />
        </Card>
      ) : null}

      <Modal
        open={renameOpen}
        title="Rename organisation"
        onClose={() => setRenameOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={renameOrganization} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <Field label="New name" required>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
        </Field>
      </Modal>

      <Modal
        open={batchModal}
        title="Create a new batch"
        onClose={() => setBatchModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatchModal(false)}>
              Cancel
            </Button>
            <Button onClick={createBatch} loading={busy} disabled={!batchName.trim()}>
              Create batch
            </Button>
          </>
        }
      >
        <Field
          label="Institution"
          hint="Every batch must belong to an organisation. This batch will live under yours."
          required
        >
          <Input
            value={data?.institution?.name || institution?.name || "Your organisation"}
            readOnly
            disabled
            style={{ background: "var(--sb-surface-2)", cursor: "not-allowed" }}
          />
        </Field>
        <Field label="Batch name" hint="Examples: Web Dev — Cohort A, Data Analytics — Spring 2026" required>
          <Input
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g. Web Dev — Cohort A"
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  );
}
