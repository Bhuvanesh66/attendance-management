import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatApiError } from "../../lib/errors.js";

export function StudentDashboard() {
  const { getToken } = useAuth();
  const [batchId, setBatchId] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("present");
  const [mySessions, setMySessions] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function getProgrammeWindow(session) {
    const offsetMin = 330; // keep in sync with backend default
    const dateStr = String(session?.date || "").slice(0, 10);
    const normTime = (t) => {
      const s = String(t || "");
      if (s.length === 5 && s[2] === ":") return `${s}:00`;
      return s || "00:00:00";
    };
    const parseParts = (isoDate, timeStr) => {
      const [y, m, d] = isoDate.split("-").map((x) => Number(x));
      const [hh, mm, ss] = String(timeStr).split(":").map((x) => Number(x || 0));
      return { y, m, d, hh, mm, ss };
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const startP = parseParts(dateStr, normTime(session?.start_time));
    const endP = parseParts(dateStr, normTime(session?.end_time));
    const toInstant = (p) =>
      new Date(Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - offsetMin * 60_000);
    const start = toInstant(startP);
    const end = toInstant(endP);
    const now = new Date();
    const state = now < start ? "upcoming" : now > end ? "ended" : "active";
    return { start, end, now, state };
  }

  async function refreshMySessions() {
    try {
      const token = await getToken();
      const data = await apiFetch("/my/sessions", { token });
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

  function normalizeInviteToken(value) {
    const v = String(value || "").trim();
    if (!v) return "";
    try {
      if (v.startsWith("http://") || v.startsWith("https://")) {
        const u = new URL(v);
        return (u.searchParams.get("token") || "").trim();
      }
    } catch (_) {
      // ignore and fall through
    }
    if (v.includes("token=")) {
      const after = v.split("token=").pop();
      return String(after || "").split(/[&\s]/)[0].trim();
    }
    return v;
  }

  async function joinBatch() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const inviteToken = normalizeInviteToken(tokenValue);
      await apiFetch(`/batches/${batchId.trim()}/join`, {
        token,
        method: "POST",
        body: { token: inviteToken },
      });
      await refreshMySessions();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function markAttendance() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch("/attendance/mark", {
        token,
        method: "POST",
        body: { sessionId: sessionId.trim(), status },
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-dashboard-grid">
      <div>
        <h1 className="sb-section-title" style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>
          Student
        </h1>
        <p className="sb-muted" style={{ margin: 0 }}>
          Join a batch with your invite, then mark attendance when a session is in its time window.
        </p>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">What your trainer sends you</h2>
        <ul className="sb-muted" style={{ margin: 0, paddingLeft: "1.25rem" }}>
          <li>
            <strong>Batch id</strong> — a UUID like{" "}
            <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>
          </li>
          <li>
            <strong>Invite token</strong> — a long hex string (not your Clerk login password)
          </li>
        </ul>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Join a batch</h2>
        <p className="sb-muted">Paste both values exactly; trailing spaces break validation.</p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Batch id (UUID)</span>
            <input
              className="sb-input"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="e.g. 8b2c1b2d-…"
            />
          </label>
          <label className="sb-field">
            <span>Invite token</span>
            <input
              className="sb-input"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Long hex string from your trainer"
            />
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={busy || !batchId.trim() || !tokenValue}
            onClick={joinBatch}
          >
            Join batch
          </button>
        </div>
      </div>

      <div className="sb-card">
        <h2 className="sb-section-title">Mark attendance</h2>
        <p className="sb-muted">Only works during the session’s scheduled start and end time.</p>
        <div className="sb-dashboard-grid" style={{ marginTop: "0.5rem" }}>
          <label className="sb-field">
            <span>Session id (UUID)</span>
            <input
              className="sb-input"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="From your schedule or trainer"
            />
          </label>
          <label className="sb-field">
            <span>Status</span>
            <select className="sb-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
          </label>
          <button
            type="button"
            className="sb-btn sb-btn-primary"
            style={{ width: "fit-content" }}
            disabled={busy || !sessionId.trim()}
            onClick={markAttendance}
          >
            Mark attendance
          </button>
        </div>
      </div>

      <div className="sb-card">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
          <h2 className="sb-section-title" style={{ margin: 0 }}>
            My sessions
          </h2>
          <button
            type="button"
            className="sb-btn"
            style={{ width: "fit-content" }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await refreshMySessions();
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Refresh
          </button>
        </div>

        <p className="sb-muted" style={{ marginTop: "0.5rem" }}>
          After you join a batch, sessions scheduled for that batch will appear here. Click one to auto-fill the Session id.
        </p>

        {mySessions.length === 0 ? (
          <div className="sb-muted" style={{ fontSize: "0.9375rem" }}>
            No sessions yet. If you just joined, ask your trainer to create a session for that batch.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            {mySessions.map((s) => (
              (() => {
                const w = getProgrammeWindow(s);
                const badge =
                  w?.state === "active"
                    ? { label: "Active now", bg: "#dcfce7", border: "#bbf7d0", color: "#14532d" }
                    : w?.state === "upcoming"
                      ? { label: "Upcoming", bg: "#eff6ff", border: "#bfdbfe", color: "#1e3a8a" }
                      : { label: "Ended", bg: "#f1f5f9", border: "#e2e8f0", color: "#334155" };
                return (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.75rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "var(--sb-radius-sm)",
                  border: "1px solid var(--sb-border)",
                  background: sessionId === String(s.id) ? "#f0fdf4" : "#fff",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSessionId(String(s.id));
                    setError(null);
                  }}
                  style={{
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
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

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: 999,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                      fontWeight: 600,
                      alignSelf: "flex-end",
                    }}
                  >
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    className="sb-btn"
                    style={{ width: "fit-content" }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(s.id));
                      } catch {
                        // ignore clipboard failure (e.g. insecure context)
                      }
                    }}
                  >
                    Copy ID
                  </button>
                  <button
                    type="button"
                    className="sb-btn sb-btn-primary"
                    style={{ width: "fit-content" }}
                    onClick={() => {
                      setSessionId(String(s.id));
                      setError(null);
                    }}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="sb-btn sb-btn-primary"
                    style={{ width: "fit-content" }}
                    disabled={busy || w?.state !== "active"}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const token = await getToken();
                        await apiFetch("/attendance/mark", {
                          token,
                          method: "POST",
                          body: { sessionId: String(s.id), status },
                        });
                      } catch (e) {
                        setError(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Mark ({status})
                  </button>
                </div>
              </div>
                );
              })()
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div
          className="sb-error-card"
          style={{ background: "#fef2f2", maxWidth: "100%", margin: 0 }}
        >
          <h2 style={{ fontSize: "1rem" }}>Something went wrong</h2>
          <p style={{ margin: 0 }}>{formatApiError(error)}</p>
        </div>
      ) : null}
    </div>
  );
}
