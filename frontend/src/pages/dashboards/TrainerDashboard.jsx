import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";
import {
  Badge,
  Button,
  Card,
  CopyableId,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  RoleBadge,
  Select,
  StatCard,
  StatGrid,
  StatusBadge,
  Table,
  Tabs,
  useToast,
} from "../../components/ui/index.js";

const TZ_OFFSET_MIN = 330; // IST default — keep in sync with backend.

function extractInstitutionId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // If the user pasted a plain UUID, accept it.
  const uuidRe =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
  const m = raw.match(uuidRe);
  if (m?.[0]) return m[0];

  // If the user pasted a URL, try to extract common query params.
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      const qp =
        (u.searchParams.get("institutionId") || u.searchParams.get("orgId") || u.searchParams.get("org") || "").trim();
      const qm = qp.match(uuidRe);
      if (qm?.[0]) return qm[0];
    }
  } catch (_) {
    // ignore URL parse errors; fall back to regex scan above
  }

  return "";
}

function getSessionState(session) {
  const dateStr = String(session?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "ended";
  const norm = (t) => {
    const s = String(t || "");
    if (s.length === 5 && s[2] === ":") return `${s}:00`;
    return s || "00:00:00";
  };
  const parts = (t) => {
    const [hh, mm, ss] = norm(t).split(":").map((x) => Number(x || 0));
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));
    return new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - TZ_OFFSET_MIN * 60_000);
  };
  const start = parts(session.start_time);
  const end = parts(session.end_time);
  const now = new Date();
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

function formatSessionWhen(session) {
  return `${String(session?.date || "").slice(0, 10)} · ${String(session?.start_time || "").slice(0, 5)}–${String(session?.end_time || "").slice(0, 5)}`;
}

export function TrainerDashboard({ profile, institution }) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [linkedProfile, setLinkedProfile] = useState(profile);
  const [linkedInstitution, setLinkedInstitution] = useState(institution || null);
  const [tab, setTab] = useState("batches");
  const [batches, setBatches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [batchModal, setBatchModal] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [batchInstitutionInput, setBatchInstitutionInput] = useState("");
  const [targetInstitutionId, setTargetInstitutionId] = useState("");
  const [busy, setBusy] = useState(false);

  const [sessionModal, setSessionModal] = useState(false);
  const [newSession, setNewSession] = useState({
    batchId: "",
    title: "",
    date: "",
    startTime: "",
    endTime: "",
  });

  const [inviteModal, setInviteModal] = useState(false);
  const [inviteBatchId, setInviteBatchId] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState(null);

  const [attendanceFor, setAttendanceFor] = useState(null);
  const [attendanceState, setAttendanceState] = useState({ loading: false, data: null });

  useEffect(() => setLinkedProfile(profile), [profile]);
  useEffect(() => setLinkedInstitution(institution || null), [institution]);
  useEffect(() => {
    const next = linkedInstitution?.id || "";
    setTargetInstitutionId(next);
    setBatchInstitutionInput(next);
  }, [linkedInstitution?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [b, s] = await Promise.all([
        apiFetch("/my/batches", { token }),
        apiFetch("/trainer/sessions", { token }),
      ]);
      setBatches(b.batches || []);
      setSessions(s.sessions || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function createBatch(e) {
    e?.preventDefault?.();
    const name = batchName.trim();
    if (!name) return;
    const institutionId = targetInstitutionId || linkedInstitution?.id || "";
    if (!institutionId) return;
    setBusy(true);
    try {
      const token = await getToken();
      const data = await apiFetch("/batches", {
        token,
        method: "POST",
        body: { name, institutionId },
      });
      if (data.profile) setLinkedProfile(data.profile);
      if (data.institution) setLinkedInstitution(data.institution);
      const orgName = data.institution?.name || linkedInstitution?.name || "your institution";
      toast.success(`Batch "${data.batch.name}" created under ${orgName}.`);
      setBatchName("");
      setBatchModal(false);
      await loadAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function createSession(e) {
    e?.preventDefault?.();
    const { batchId, title, date, startTime, endTime } = newSession;
    if (!batchId || !title.trim() || !date || !startTime || !endTime) return;
    setBusy(true);
    try {
      const token = await getToken();
      const data = await apiFetch("/sessions", {
        token,
        method: "POST",
        body: { batchId, title: title.trim(), date, startTime, endTime },
      });
      toast.success(`Session "${data.session.title}" scheduled.`);
      setSessionModal(false);
      setNewSession({ batchId: "", title: "", date: "", startTime: "", endTime: "" });
      await loadAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function generateInvite(e) {
    e?.preventDefault?.();
    if (!inviteBatchId) return;
    setBusy(true);
    try {
      const token = await getToken();
      const data = await apiFetch(`/batches/${inviteBatchId}/invite`, {
        token,
        method: "POST",
        body: { reusable: true },
      });
      setGeneratedInvite({
        batchId: inviteBatchId,
        token: data.invite.token,
        joinUrl: `${window.location.origin}/app?join=${inviteBatchId}&token=${data.invite.token}`,
      });
      toast.success("Invite generated. Share the link or token with your students.");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadAttendance(session) {
    setAttendanceFor(session);
    setAttendanceState({ loading: true, data: null });
    try {
      const token = await getToken();
      const data = await apiFetch(`/sessions/${session.id}/attendance`, { token });
      setAttendanceState({ loading: false, data });
    } catch (err) {
      setAttendanceState({ loading: false, data: null });
      toast.error(formatApiError(err));
    }
  }

  const sessionStats = useMemo(() => {
    const counts = { active: 0, upcoming: 0, ended: 0 };
    for (const s of sessions) {
      counts[getSessionState(s)] = (counts[getSessionState(s)] || 0) + 1;
    }
    return counts;
  }, [sessions]);

  const tabs = [
    { key: "batches", label: "Batches", icon: "📚", badge: batches.length || undefined },
    { key: "sessions", label: "Sessions", icon: "🗓️", badge: sessions.length || undefined },
    { key: "invites", label: "Invite students", icon: "🎟️" },
    { key: "attendance", label: "Attendance", icon: "✅" },
  ];

  return (
    <div className="ui-stack ui-stack--lg">
      <PageHeader
        eyebrow={linkedProfile?.name ? `Hello, ${linkedProfile.name}` : "Trainer workspace"}
        title="Trainer dashboard"
        subtitle={
          linkedInstitution?.name
            ? `You're attached to ${linkedInstitution.name}. Every batch you create lives under this organisation.`
            : "Create batches, schedule sessions, invite students, and review attendance — all in one place."
        }
        actions={
          <>
            <Button variant="secondary" onClick={loadAll} loading={loading}>
              Refresh
            </Button>
            <Button onClick={() => setBatchModal(true)} disabled={!linkedInstitution}>+ New batch</Button>
          </>
        }
        badge={<RoleBadge role="Trainer" />}
      />

      {!linkedInstitution ? (
        <Card>
          <EmptyState
            title="No institution attached yet"
            hint="A trainer must belong to an institution before they can create a batch. Refresh the page or ask an Institution-role admin to set up the organisation first."
            icon="🏢"
            action={<Button variant="secondary" onClick={loadAll}>Refresh</Button>}
          />
        </Card>
      ) : null}

      <StatGrid min={150}>
        <StatCard label="Batches" value={batches.length} icon="📚" tone="info" />
        <StatCard label="Sessions" value={sessions.length} icon="🗓️" tone="neutral" />
        <StatCard label="Live now" value={sessionStats.active || 0} icon="🟢" tone="success" />
        <StatCard label="Upcoming" value={sessionStats.upcoming || 0} icon="⏳" tone="warning" />
      </StatGrid>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "batches" ? (
        <Card
          title="Your batches"
          subtitle="Batches you've created or were assigned to. They live under your institution."
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
                render: (b) => sessions.filter((s) => String(s.batch_id) === String(b.id)).length,
              },
              {
                key: "actions",
                label: "",
                render: (b) => (
                  <div className="ui-row">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setNewSession((v) => ({ ...v, batchId: b.id }));
                        setSessionModal(true);
                      }}
                    >
                      + Session
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setInviteBatchId(b.id);
                        setGeneratedInvite(null);
                        setInviteModal(true);
                      }}
                    >
                      Invite
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={batches}
            empty={
              <EmptyState
                title="No batches yet"
                hint="Create a batch first — sessions and invites attach to a batch."
                icon="📚"
                action={<Button onClick={() => setBatchModal(true)}>+ Create your first batch</Button>}
              />
            }
          />
        </Card>
      ) : null}

      {tab === "sessions" ? (
        <Card
          title="Sessions"
          subtitle="Schedule new sessions or jump into attendance for any session."
          actions={
            <Button
              size="sm"
              onClick={() => {
                setNewSession((v) => ({ ...v, batchId: v.batchId || batches[0]?.id || "" }));
                setSessionModal(true);
              }}
              disabled={batches.length === 0}
            >
              + New session
            </Button>
          }
        >
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
                key: "when",
                label: "When",
                render: (s) => formatSessionWhen(s),
              },
              {
                key: "state",
                label: "Status",
                render: (s) => <StatusBadge status={getSessionState(s)} />,
              },
              {
                key: "actions",
                label: "",
                render: (s) => (
                  <Button size="sm" variant="secondary" onClick={() => loadAttendance(s)}>
                    Attendance
                  </Button>
                ),
              },
            ]}
            rows={sessions}
            empty={
              <EmptyState
                title="No sessions yet"
                hint="Create a batch first, then schedule a session for it."
                icon="🗓️"
                action={
                  batches.length > 0 ? (
                    <Button
                      onClick={() => {
                        setNewSession((v) => ({ ...v, batchId: batches[0].id }));
                        setSessionModal(true);
                      }}
                    >
                      + Schedule a session
                    </Button>
                  ) : null
                }
              />
            }
          />
        </Card>
      ) : null}

      {tab === "invites" ? (
        <Card title="Invite students to a batch" subtitle="Generate a reusable join link or token. Students paste it into their dashboard.">
          <form onSubmit={generateInvite} className="ui-stack">
            <Field label="Batch" required>
              <Select
                value={inviteBatchId}
                onChange={(e) => setInviteBatchId(e.target.value)}
                disabled={batches.length === 0}
              >
                <option value="">— Select a batch —</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="ui-form-actions">
              <Button type="submit" disabled={!inviteBatchId} loading={busy}>
                Generate reusable invite
              </Button>
            </div>
          </form>

          {generatedInvite ? (
            <div className="ui-stack" style={{ marginTop: "1.25rem" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Share this with your students</div>
                <p className="ui-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                  They can paste the join link directly, or use the batch ID + token in their dashboard.
                </p>
              </div>
              <Field label="Join link">
                <div className="ui-row" style={{ gap: "0.5rem" }}>
                  <Input value={generatedInvite.joinUrl} readOnly style={{ fontFamily: "var(--sb-mono)", fontSize: "0.8rem" }} />
                  <CopyButton value={generatedInvite.joinUrl}>Copy link</CopyButton>
                </div>
              </Field>
              <Field label="Or share these directly">
                <div className="ui-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <CopyableId value={generatedInvite.batchId} label="Batch ID" />
                  <CopyableId value={generatedInvite.token} label="Token" />
                </div>
              </Field>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "attendance" ? (
        <Card title="Attendance" subtitle="Pick a session to see who marked present, late, absent, or hasn't yet.">
          <div className="ui-stack">
            <Field label="Session">
              <Select
                value={attendanceFor?.id || ""}
                onChange={(e) => {
                  const s = sessions.find((x) => String(x.id) === e.target.value);
                  if (s) loadAttendance(s);
                }}
                disabled={sessions.length === 0}
              >
                <option value="">— Select a session —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || "Session"} — {s.batch_name || "—"} — {formatSessionWhen(s)}
                  </option>
                ))}
              </Select>
            </Field>

            {attendanceFor ? (
              <div className="ui-stack">
                <div className="ui-row ui-row--between">
                  <div>
                    <div style={{ fontWeight: 700 }}>{attendanceFor.title}</div>
                    <span className="ui-muted" style={{ fontSize: "0.85rem" }}>
                      {formatSessionWhen(attendanceFor)} · Batch: {attendanceFor.batch_name || "—"}
                    </span>
                  </div>
                  <StatusBadge status={getSessionState(attendanceFor)} />
                </div>

                {attendanceState.loading ? (
                  <p className="ui-muted">Loading…</p>
                ) : (
                  <Table
                    columns={[
                      {
                        key: "name",
                        label: "Student",
                        render: (r) => (
                          <div>
                            <div style={{ fontWeight: 600 }}>{r.student_name || "Student"}</div>
                            <span className="ui-muted" style={{ fontSize: "0.8rem" }}>
                              {r.student_email || "—"}
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (r) => <StatusBadge status={r.status} />,
                      },
                      {
                        key: "marked_at",
                        label: "Marked at",
                        render: (r) => (r.marked_at ? new Date(r.marked_at).toLocaleString() : "—"),
                      },
                    ]}
                    rows={attendanceState.data?.attendance || []}
                    empty={
                      <EmptyState
                        title="No students enrolled yet"
                        hint="Generate an invite link from the Invite students tab and share with your batch."
                        icon="✅"
                      />
                    }
                  />
                )}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* ---------- Modals ---------- */}
      <Modal
        open={batchModal}
        title="Create a new batch"
        onClose={() => setBatchModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatchModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={createBatch}
              loading={busy}
              disabled={!batchName.trim() || !linkedInstitution || !targetInstitutionId}
            >
              Create
            </Button>
          </>
        }
      >
        <Field
          label="Institution"
          hint="Default is your attached organisation. To create a batch for a different institute, paste that organisation link or ID below."
          required
        >
          <Input
            value={
              targetInstitutionId && linkedInstitution?.id === targetInstitutionId
                ? linkedInstitution?.name || "Your organisation"
                : targetInstitutionId
                  ? "Custom organisation"
                  : "No institution selected"
            }
            readOnly
            disabled
            style={{ background: "var(--sb-surface-2)", cursor: "not-allowed" }}
          />
        </Field>
        <Field
          label="Organisation link / ID"
          hint="Paste an organisation link (or UUID). We'll extract the organisation ID for batch creation."
          required
        >
          <Input
            value={batchInstitutionInput}
            onChange={(e) => {
              const v = e.target.value;
              setBatchInstitutionInput(v);
              const id = extractInstitutionId(v);
              setTargetInstitutionId(id || "");
            }}
            placeholder={linkedInstitution?.id || "Paste organisation link or UUID"}
            style={{ fontFamily: "var(--sb-mono)" }}
          />
          {batchInstitutionInput.trim() && !targetInstitutionId ? (
            <p style={{ color: "var(--sb-danger)", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
              Couldn’t find an organisation ID in that text. Paste the UUID (like {linkedInstitution?.id || "…"}) or a link containing it.
            </p>
          ) : null}
          {targetInstitutionId ? (
            <p className="ui-muted" style={{ fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
              Using organisation ID: <span style={{ fontFamily: "var(--sb-mono)" }}>{targetInstitutionId}</span>
            </p>
          ) : null}
        </Field>
        <Field label="Batch name" hint="Examples: Web Dev — Cohort A, Data Analytics — Spring 2026" required>
          <Input
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g. Web Dev — Cohort A"
            autoFocus
          />
        </Field>
        {!linkedInstitution ? (
          <p style={{ color: "var(--sb-danger)", fontSize: "0.85rem", margin: 0 }}>
            You aren't attached to an institution yet. Close this dialog and refresh — the system attaches Trainers to
            an organisation automatically on first sign-in.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={sessionModal}
        title="Schedule a new session"
        size="lg"
        onClose={() => setSessionModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSessionModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={createSession}
              loading={busy}
              disabled={
                !newSession.batchId ||
                !newSession.title.trim() ||
                !newSession.date ||
                !newSession.startTime ||
                !newSession.endTime
              }
            >
              Schedule session
            </Button>
          </>
        }
      >
        <Field label="Batch" required>
          <Select
            value={newSession.batchId}
            onChange={(e) => setNewSession((v) => ({ ...v, batchId: e.target.value }))}
          >
            <option value="">— Select a batch —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Session title" required>
          <Input
            value={newSession.title}
            onChange={(e) => setNewSession((v) => ({ ...v, title: e.target.value }))}
            placeholder="e.g. Intro to HTML & CSS"
          />
        </Field>
        <div className="ui-grid-2">
          <Field label="Date" required>
            <Input
              type="date"
              value={newSession.date}
              onChange={(e) => setNewSession((v) => ({ ...v, date: e.target.value }))}
            />
          </Field>
        </div>
        <div className="ui-grid-2">
          <Field label="Start time" required>
            <Input
              type="time"
              value={newSession.startTime}
              onChange={(e) => setNewSession((v) => ({ ...v, startTime: e.target.value }))}
            />
          </Field>
          <Field label="End time" required>
            <Input
              type="time"
              value={newSession.endTime}
              onChange={(e) => setNewSession((v) => ({ ...v, endTime: e.target.value }))}
            />
          </Field>
        </div>
        <p className="ui-muted" style={{ fontSize: "0.825rem", margin: 0 }}>
          Times are interpreted in programme local time (IST by default). Students can mark attendance only between Start
          and End.
        </p>
      </Modal>

      <Modal
        open={inviteModal}
        title="Invite students to a batch"
        onClose={() => {
          setInviteModal(false);
          setGeneratedInvite(null);
        }}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setInviteModal(false);
              setGeneratedInvite(null);
            }}
          >
            Done
          </Button>
        }
      >
        {!generatedInvite ? (
          <form onSubmit={generateInvite}>
            <Field label="Batch" required>
              <Select
                value={inviteBatchId}
                onChange={(e) => setInviteBatchId(e.target.value)}
              >
                <option value="">— Select a batch —</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="ui-form-actions">
              <Button type="submit" disabled={!inviteBatchId} loading={busy}>
                Generate reusable invite
              </Button>
            </div>
          </form>
        ) : (
          <div className="ui-stack">
            <Field label="Join link">
              <div className="ui-row" style={{ gap: "0.5rem" }}>
                <Input value={generatedInvite.joinUrl} readOnly style={{ fontFamily: "var(--sb-mono)", fontSize: "0.8rem" }} />
                <CopyButton value={generatedInvite.joinUrl}>Copy link</CopyButton>
              </div>
            </Field>
            <Field label="Or share separately">
              <div className="ui-row">
                <CopyableId value={generatedInvite.batchId} label="Batch ID" />
                <CopyableId value={generatedInvite.token} label="Token" />
              </div>
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!attendanceFor}
        title={attendanceFor ? `Attendance — ${attendanceFor.title}` : "Attendance"}
        onClose={() => {
          setAttendanceFor(null);
          setAttendanceState({ loading: false, data: null });
        }}
        size="lg"
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setAttendanceFor(null);
              setAttendanceState({ loading: false, data: null });
            }}
          >
            Close
          </Button>
        }
      >
        {attendanceFor ? (
          attendanceState.loading ? (
            <p className="ui-muted">Loading…</p>
          ) : (
            <Table
              columns={[
                {
                  key: "name",
                  label: "Student",
                  render: (r) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.student_name || "Student"}</div>
                      <span className="ui-muted" style={{ fontSize: "0.8rem" }}>
                        {r.student_email || "—"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <StatusBadge status={r.status} />,
                },
                {
                  key: "marked_at",
                  label: "Marked",
                  render: (r) => (r.marked_at ? new Date(r.marked_at).toLocaleString() : "—"),
                },
              ]}
              rows={attendanceState.data?.attendance || []}
              empty={<EmptyState title="No students enrolled" icon="✅" />}
            />
          )
        ) : null}
      </Modal>
    </div>
  );
}
