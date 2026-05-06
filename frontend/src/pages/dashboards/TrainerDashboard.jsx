import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";

function UuidHint() {
  return (
    <div
      style={{
        fontSize: "0.8125rem",
        padding: "0.75rem 1rem",
        borderRadius: "var(--sb-radius-sm)",
        background: "#eef2ff",
        border: "1px solid #c7d2fe",
        color: "#3730a3",
      }}
    >
      <strong>IDs look like this:</strong> <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code> (letters and numbers with
      dashes). After you create a batch, its id appears below — copy/paste it for invites or student signup.
    </div>
  );
}

export function TrainerDashboard({ profile }) {
  const { getToken } = useAuth();
  const [linkedProfile, setLinkedProfile] = useState(profile);
  const [myBatches, setMyBatches] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [batchName, setBatchName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [inviteToken, setInviteToken] = useState(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [createdSession, setCreatedSession] = useState(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [attendanceState, setAttendanceState] = useState({ loading: false, data: null, error: null });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLinkedProfile(profile);
  }, [profile]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch("/my/batches", { token });
        if (!alive) return;
        setMyBatches(data.batches || []);
      } catch {
        if (!alive) return;
        setMyBatches([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  async function refreshMySessions() {
    try {
      const token = await getToken();
      const data = await apiFetch("/trainer/sessions", { token });
      setMySessions(data.sessions || []);
    } catch {
      setMySessions([]);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await refreshMySessions();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBatch() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await apiFetch("/batches", {
        token,
        method: "POST",
        body: { name: batchName.trim() },
      });
      setBatchId(String(data.batch.id));
      if (data.profile) setLinkedProfile(data.profile);
      const refresh = await apiFetch("/my/batches", { token });
      setMyBatches(refresh.batches || []);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function generateInvite() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const id = batchId.trim();
      const data = await apiFetch(`/batches/${id}/invite`, {
        token,
        method: "POST",
        body: { reusable: true },
      });
      setInviteToken(data.invite.token);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function createSession() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await apiFetch("/sessions", {
        token,
        method: "POST",
        body: {
          batchId: batchId.trim(),
          title: sessionTitle.trim(),
          date: sessionDate,
          startTime: sessionStart,
          endTime: sessionEnd,
        },
      });
      setCreatedSession(data.session);
      if (!sessionTitle.trim()) setSessionTitle("");
      await refreshMySessions();
    } catch (e) {
      setError(e);
      setCreatedSession(null);
    } finally {
      setBusy(false);
    }
  }

  async function loadAttendance() {
    setAttendanceState({ loading: true, data: null, error: null });
    try {
      const token = await getToken();
      const id = attendanceSessionId.trim();
      const data = await apiFetch(`/sessions/${id}/attendance`, { token });
      setAttendanceState({ loading: false, data, error: null });
    } catch (e) {
      setAttendanceState({ loading: false, data: null, error: e });
    }
  }

  const errText = error ? formatApiError(error) : "";
  const missingSessionFields = [
    !batchId.trim() ? "Batch id" : null,
    !sessionTitle.trim() ? "Title" : null,
    !sessionDate ? "Date (YYYY-MM-DD)" : null,
    !sessionStart ? "Start time (HH:MM)" : null,
    !sessionEnd ? "End time (HH:MM)" : null,
  ].filter(Boolean);

  return (
    <div className="sb-dashboard-grid">
      <div>
        <h1 className="sb-section-title" style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>
          Trainer
        </h1>
        <p className="sb-muted" style={{ margin: 0 }}>
          Demo flow: create a batch → copy its id → generate invite → give students <strong>batch id + token</strong>.
        </p>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">How this prototype works</h2>
        <ul className="sb-muted" style={{ margin: "0 0 0.75rem", paddingLeft: "1.25rem" }}>
          <li>
            A small <strong>organisation</strong> is created for you automatically so batches have an institution (required
            by the database).
          </li>
          <li>
            Your organisation id:{" "}
            <code style={{ wordBreak: "break-all" }}>
              {linkedProfile?.institution_id || "(refresh after creating a batch if missing)"}
            </code>
          </li>
          <li>You do not need a separate &quot;Institution&quot; account for this demo.</li>
        </ul>
        <UuidHint />
      </div>

      {myBatches.length > 0 ? (
        <div className="sb-card">
          <h2 className="sb-section-title">Your batches</h2>
          <p className="sb-muted">Click a row to fill the Batch id field for invites.</p>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
            {myBatches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBatchId(String(b.id));
                  setError(null);
                }}
                style={{
                  textAlign: "left",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "var(--sb-radius-sm)",
                  border: "1px solid var(--sb-border)",
                  background: batchId === String(b.id) ? "#eef2ff" : "#fff",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.85, wordBreak: "break-all" }}>{b.id}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mySessions.length > 0 ? (
        <div className="sb-card">
          <h2 className="sb-section-title">Your sessions</h2>
          <p className="sb-muted">Click a session to fill “Session id” for attendance viewing.</p>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
            {mySessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setAttendanceSessionId(String(s.id));
                  setAttendanceState({ loading: false, data: null, error: null });
                  setError(null);
                }}
                style={{
                  textAlign: "left",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "var(--sb-radius-sm)",
                  border: "1px solid var(--sb-border)",
                  background: attendanceSessionId === String(s.id) ? "#eef2ff" : "#fff",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: 600 }}>{s.title || "Session"}</div>
                <div className="sb-muted" style={{ fontSize: "0.8125rem" }}>
                  {s.batch_name ? (
                    <>
                      <strong>Batch:</strong> {s.batch_name}{" "}
                    </>
                  ) : null}
                  <span style={{ wordBreak: "break-all" }}>
                    <strong>ID:</strong> {s.id}
                  </span>
                </div>
                <div className="sb-muted" style={{ fontSize: "0.8125rem" }}>
                  <strong>When:</strong> {s.date} {String(s.start_time || "").slice(0, 5)}–{String(s.end_time || "").slice(0, 5)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sb-card">
        <h2 className="sb-section-title">Create batch</h2>
        <p className="sb-muted">Batch name is free text (e.g. &quot;Web Dev — Cohort A&quot;).</p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Batch name</span>
            <input
              className="sb-input"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Web Dev — Cohort A"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={busy || !batchName.trim()}
            onClick={createBatch}
          >
            Create batch
          </button>
        </div>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Invite students</h2>
        <p className="sb-muted">
          Paste the <strong>batch UUID</strong> from above (or use &quot;Your batches&quot;). Then generate a{' '}
          <strong>reusable</strong> token students paste alongside that id on the Student screen.
        </p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Batch id (UUID)</span>
            <input
              className="sb-input"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={busy || !batchId.trim()}
            onClick={generateInvite}
          >
            Generate reusable invite
          </button>
        </div>

        {inviteToken ? (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.35rem" }}>
              Invite token (share with students)
            </div>
            <code
              style={{
                display: "block",
                padding: "0.75rem 1rem",
                borderRadius: "var(--sb-radius-sm)",
                background: "#f1f5f9",
                border: "1px solid var(--sb-border)",
                fontSize: "0.8125rem",
                wordBreak: "break-all",
              }}
            >
              {inviteToken}
            </code>
            <p className="sb-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              Student enters <strong>this batch id</strong> + <strong>this token</strong> on their dashboard, then Join
              batch.
            </p>
          </div>
        ) : null}
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Create session</h2>
        <p className="sb-muted">
          Sessions are created for a batch. After you create one, students who joined that batch will see it in{" "}
          <strong>Student → My sessions</strong>.
        </p>
        <p className="sb-muted" style={{ marginTop: "0.5rem" }}>
          Use these formats: <code>YYYY-MM-DD</code> and <code>HH:MM</code>.
        </p>

        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Batch id (UUID)</span>
            <input
              className="sb-input"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>

          <label className="sb-field">
            <span>Title</span>
            <input
              className="sb-input"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. HTML basics"
            />
          </label>

          <label className="sb-field">
            <span>Date</span>
            <input
              className="sb-input"
              type="text"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              inputMode="numeric"
            />
          </label>

          <label className="sb-field">
            <span>Start time</span>
            <input
              className="sb-input"
              type="text"
              value={sessionStart}
              onChange={(e) => setSessionStart(e.target.value)}
              placeholder="HH:MM"
              inputMode="numeric"
            />
          </label>

          <label className="sb-field">
            <span>End time</span>
            <input
              className="sb-input"
              type="text"
              value={sessionEnd}
              onChange={(e) => setSessionEnd(e.target.value)}
              placeholder="HH:MM"
              inputMode="numeric"
            />
          </label>

          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={busy || !batchId.trim() || !sessionTitle.trim() || !sessionDate || !sessionStart || !sessionEnd}
            onClick={createSession}
          >
            Create session
          </button>
        </div>

        {missingSessionFields.length > 0 ? (
          <div className="sb-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
            <strong>To enable “Create session”</strong>, fill: {missingSessionFields.join(", ")}.
          </div>
        ) : null}

        {createdSession ? (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.35rem" }}>Session created</div>
            <div className="sb-muted" style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              Share this <strong>Session ID</strong> only if needed — normally students can pick it from their{" "}
              <strong>My sessions</strong> list.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <code
                style={{
                  display: "block",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--sb-radius-sm)",
                  background: "#f1f5f9",
                  border: "1px solid var(--sb-border)",
                  fontSize: "0.8125rem",
                  wordBreak: "break-all",
                }}
              >
                {createdSession.id}
              </code>
              <button
                type="button"
                className="sb-btn"
                style={{ width: "fit-content" }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(String(createdSession.id));
                  } catch {
                    // ignore clipboard failure
                  }
                }}
              >
                Copy ID
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">View attendance for a session</h2>
        <p className="sb-muted">Paste a session UUID (or click one above). This shows all students’ marks for that session.</p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Session id (UUID)</span>
            <input
              className="sb-input"
              value={attendanceSessionId}
              onChange={(e) => setAttendanceSessionId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={!attendanceSessionId.trim() || attendanceState.loading}
            onClick={loadAttendance}
          >
            {attendanceState.loading ? "Loading…" : "Load attendance"}
          </button>
        </div>

        {attendanceState.error ? (
          <p style={{ color: "var(--sb-danger)", marginTop: "1rem", marginBottom: 0 }}>
            {formatApiError(attendanceState.error)}
          </p>
        ) : null}

        {attendanceState.data ? (
          <>
            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Students in this session</div>
              <div className="sb-muted" style={{ fontSize: "0.875rem" }}>
                Status is <strong>present</strong>, <strong>late</strong>, <strong>absent</strong>, or <strong>not marked yet</strong>.
              </div>
            </div>

            <div
              style={{
                marginTop: "0.75rem",
                border: "1px solid var(--sb-border)",
                borderRadius: "var(--sb-radius-sm)",
                overflow: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                      Student
                    </th>
                    <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                      Student id
                    </th>
                    <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                      Email
                    </th>
                    <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                      Status
                    </th>
                    <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                      Marked at
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(attendanceState.data.attendance || []).map((row) => (
                    <tr key={row.student_id}>
                      <td style={{ padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                        {row.student_name || "Student"}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem 0.75rem",
                          borderBottom: "1px solid var(--sb-border)",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: "0.8125rem",
                          wordBreak: "break-all",
                        }}
                      >
                        {row.student_id}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--sb-border)", wordBreak: "break-all" }}>
                        {row.student_email || "—"}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                        {row.status || "not marked yet"}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--sb-border)" }}>
                        {row.marked_at ? String(row.marked_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="sb-card" style={{ marginTop: "0.75rem", cursor: "pointer" }}>
              <summary style={{ fontWeight: 600 }}>Raw JSON</summary>
              <pre style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.8125rem", overflow: "auto" }}>
                {JSON.stringify(attendanceState.data, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="sb-error-card" style={{ maxWidth: "100%", margin: 0 }}>
          <h2 style={{ fontSize: "1rem" }}>Something went wrong</h2>
          <p style={{ margin: 0 }}>{errText}</p>
        </div>
      ) : null}
    </div>
  );
}
