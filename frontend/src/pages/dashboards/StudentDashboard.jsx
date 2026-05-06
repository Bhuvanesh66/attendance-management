import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";
import {
  Badge,
  Button,
  Card,
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
  Tabs,
  useToast,
} from "../../components/ui/index.js";

const TZ_OFFSET_MIN = 330;

function getSessionState(session) {
  const dateStr = String(session?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { state: "ended", start: null, end: null };
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
  if (now < start) return { state: "upcoming", start, end };
  if (now > end) return { state: "ended", start, end };
  return { state: "active", start, end };
}

function formatRelative(d) {
  if (!d) return "";
  const ms = d.getTime() - Date.now();
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60_000);
  if (min < 1) return "now";
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  let label;
  if (min < 60) label = `${min} min`;
  else if (hr < 24) label = `${hr}h`;
  else label = `${day}d`;
  return ms > 0 ? `in ${label}` : `${label} ago`;
}

function normalizeInviteToken(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  try {
    if (v.startsWith("http://") || v.startsWith("https://")) {
      const u = new URL(v);
      return (u.searchParams.get("token") || "").trim();
    }
  } catch {
    // ignore
  }
  if (v.includes("token=")) {
    const after = v.split("token=").pop();
    return String(after || "").split(/[&\s]/)[0].trim();
  }
  return v;
}

function inferBatchIdFromToken(value) {
  const v = String(value || "").trim();
  if (!v.startsWith("http")) return "";
  try {
    const u = new URL(v);
    const fromQuery = u.searchParams.get("batchId") || u.searchParams.get("batch") || "";
    if (fromQuery) return fromQuery;
    const m = u.pathname.match(/batches\/([0-9a-f-]{36})/i);
    if (m) return m[1];
  } catch {
    // ignore
  }
  return "";
}

export function StudentDashboard() {
  const { getToken } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("sessions");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [batchId, setBatchId] = useState(searchParams.get("join") || "");
  const [tokenValue, setTokenValue] = useState(searchParams.get("token") || "");
  const [busy, setBusy] = useState(false);

  const [markFor, setMarkFor] = useState(null);
  const [markStatus, setMarkStatus] = useState("present");

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const data = await apiFetch("/my/sessions", { token });
      setSessions(data.sessions || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Auto-switch to Join tab when arriving with ?join=&token=
  useEffect(() => {
    const join = searchParams.get("join");
    const tok = searchParams.get("token");
    if (join && tok) {
      setTab("join");
      setBatchId(join);
      setTokenValue(tok);
    }
  }, [searchParams]);

  async function joinBatch(e) {
    e?.preventDefault?.();
    setBusy(true);
    try {
      const token = await getToken();
      const inviteToken = normalizeInviteToken(tokenValue);
      const inferred = inferBatchIdFromToken(tokenValue);
      const id = (inferred || batchId).trim();
      if (!id) {
        toast.error("Batch ID is required.");
        setBusy(false);
        return;
      }
      await apiFetch(`/batches/${id}/join`, {
        token,
        method: "POST",
        body: { token: inviteToken },
      });
      toast.success("You've joined the batch.");
      setBatchId("");
      setTokenValue("");
      // Clear the join query params
      const next = new URLSearchParams(searchParams);
      next.delete("join");
      next.delete("token");
      setSearchParams(next, { replace: true });
      setTab("sessions");
      await refreshSessions();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function markAttendance(session, status) {
    setBusy(true);
    try {
      const token = await getToken();
      await apiFetch("/attendance/mark", {
        token,
        method: "POST",
        body: { sessionId: String(session.id), status },
      });
      toast.success(`Attendance recorded as ${status}.`);
      setMarkFor(null);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  // Group sessions by state
  const grouped = useMemo(() => {
    const out = { active: [], upcoming: [], ended: [] };
    for (const s of sessions) {
      const w = getSessionState(s);
      out[w.state]?.push({ ...s, _state: w.state, _start: w.start, _end: w.end });
    }
    return out;
  }, [sessions]);

  const tabs = [
    {
      key: "sessions",
      label: "Sessions",
      icon: "🗓️",
      badge: sessions.length || undefined,
    },
    { key: "join", label: "Join a batch", icon: "🎟️" },
  ];

  return (
    <div className="ui-stack ui-stack--lg">
      <PageHeader
        eyebrow="Student workspace"
        title="Your sessions"
        subtitle="See sessions for the batches you've joined and mark your attendance during the session window."
        actions={
          <>
            <Button variant="secondary" onClick={refreshSessions} loading={loading}>
              Refresh
            </Button>
            <Button onClick={() => setTab("join")}>Join a batch</Button>
          </>
        }
        badge={<RoleBadge role="Student" />}
      />

      <StatGrid min={150}>
        <StatCard label="Total sessions" value={sessions.length} icon="🗓️" tone="info" />
        <StatCard label="Live now" value={grouped.active.length} icon="🟢" tone="success" />
        <StatCard label="Upcoming" value={grouped.upcoming.length} icon="⏳" tone="warning" />
        <StatCard label="Past" value={grouped.ended.length} icon="📁" tone="neutral" />
      </StatGrid>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "sessions" ? (
        <div className="ui-stack ui-stack--lg">
          <Card title="Live now" subtitle="You can mark attendance for these sessions right now." icon="🟢">
            {grouped.active.length === 0 ? (
              <EmptyState
                title="No sessions are live"
                hint="When a session reaches its scheduled start time, it'll show up here."
                icon="⏰"
              />
            ) : (
              <div className="ui-stack ui-stack--sm">
                {grouped.active.map((s) => (
                  <SessionCard key={s.id} session={s} onMark={() => setMarkFor(s)} />
                ))}
              </div>
            )}
          </Card>

          {grouped.upcoming.length > 0 ? (
            <Card title="Upcoming" subtitle="Sessions scheduled for the future." icon="⏳">
              <div className="ui-stack ui-stack--sm">
                {grouped.upcoming.map((s) => (
                  <SessionCard key={s.id} session={s} disabledReason="Mark opens at start time" />
                ))}
              </div>
            </Card>
          ) : null}

          {grouped.ended.length > 0 ? (
            <Card title="Past sessions" subtitle="Sessions you can no longer mark." icon="📁">
              <div className="ui-stack ui-stack--sm">
                {grouped.ended.map((s) => (
                  <SessionCard key={s.id} session={s} disabledReason="Window closed" />
                ))}
              </div>
            </Card>
          ) : null}

          {sessions.length === 0 ? (
            <Card>
              <EmptyState
                title="No sessions yet"
                hint="Join a batch using the link or token your trainer shared."
                icon="🎟️"
                action={<Button onClick={() => setTab("join")}>Join a batch</Button>}
              />
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "join" ? (
        <Card
          title="Join a batch"
          subtitle="Paste the join link from your trainer, or enter the batch ID and token separately."
          icon="🎟️"
        >
          <form onSubmit={joinBatch} className="ui-stack">
            <Field
              label="Join link or invite token"
              hint="Trainer-shared full URL works too — we'll auto-detect the batch ID and token."
              required
            >
              <Input
                value={tokenValue}
                onChange={(e) => {
                  setTokenValue(e.target.value);
                  const inferred = inferBatchIdFromToken(e.target.value);
                  if (inferred && !batchId) setBatchId(inferred);
                }}
                placeholder="https://… or a long hex token"
              />
            </Field>
            <Field
              label="Batch ID"
              hint="Optional if you pasted a full join link above."
            >
              <Input
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Field>
            <div className="ui-form-actions">
              <Button type="submit" loading={busy} disabled={!tokenValue.trim()}>
                Join batch
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Mark attendance modal */}
      <Modal
        open={!!markFor}
        title={markFor ? `Mark attendance — ${markFor.title}` : "Mark attendance"}
        onClose={() => setMarkFor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMarkFor(null)}>
              Cancel
            </Button>
            <Button onClick={() => markFor && markAttendance(markFor, markStatus)} loading={busy}>
              Mark as {markStatus}
            </Button>
          </>
        }
      >
        {markFor ? (
          <div className="ui-stack">
            <div>
              <div style={{ fontWeight: 600 }}>{markFor.title}</div>
              <span className="ui-muted" style={{ fontSize: "0.85rem" }}>
                Batch: {markFor.batch_name || "—"} · {String(markFor.date).slice(0, 10)}{" "}
                {String(markFor.start_time || "").slice(0, 5)}–{String(markFor.end_time || "").slice(0, 5)}
              </span>
            </div>
            <Field label="Status">
              <Select value={markStatus} onChange={(e) => setMarkStatus(e.target.value)}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function SessionCard({ session, onMark, disabledReason }) {
  const w = getSessionState(session);
  const isActive = w.state === "active";
  const dateStr = String(session?.date || "").slice(0, 10);
  return (
    <div className={`ui-session-card ${isActive ? "ui-session-card--active" : ""}`}>
      <div className="ui-row ui-row--between" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ui-session-card__title">{session.title || "Session"}</div>
          <div className="ui-session-card__meta">
            <span><strong>Batch:</strong> {session.batch_name || "—"}</span>
            <span><strong>When:</strong> {dateStr} {String(session.start_time || "").slice(0, 5)}–{String(session.end_time || "").slice(0, 5)}</span>
          </div>
        </div>
        <StatusBadge status={w.state} />
      </div>
      <div className="ui-session-card__footer">
        <span className="ui-muted" style={{ fontSize: "0.8rem" }}>
          {w.state === "active" && w.end ? `Ends ${formatRelative(w.end)}` : null}
          {w.state === "upcoming" && w.start ? `Starts ${formatRelative(w.start)}` : null}
          {w.state === "ended" && w.end ? `Ended ${formatRelative(w.end)}` : null}
        </span>
        {onMark ? (
          <Button size="sm" onClick={onMark}>
            Mark attendance
          </Button>
        ) : disabledReason ? (
          <Badge tone="neutral">{disabledReason}</Badge>
        ) : null}
      </div>
    </div>
  );
}
