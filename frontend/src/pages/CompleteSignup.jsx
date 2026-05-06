import { useAuth, useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { apiFetch } from "../lib/api";
import { formatApiError } from "../lib/errors.js";
import { useNavigate } from "react-router-dom";

const ROLES = [
  { value: "Student", label: "Student", hint: "Join batches and mark attendance" },
  { value: "Trainer", label: "Trainer", hint: "Create sessions and view marks" },
  { value: "Institution", label: "Institution", hint: "Oversee batches at your org" },
  { value: "ProgrammeManager", label: "Programme manager", hint: "Programme-wide summaries" },
  { value: "MonitoringOfficer", label: "Monitoring officer", hint: "Cross-programme reporting" },
];

export function CompleteSignup() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState("Student");
  const [name, setName] = useState(user?.fullName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch("/auth/complete-signup", {
        token,
        method: "POST",
        body: { role, name },
      });
      nav("/app", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sb-card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2 className="sb-section-title">Finish setting up your account</h2>
      <p className="sb-muted" style={{ margin: "0 0 1.25rem" }}>
        Pick how you use SkillBridge. You can contact an admin later if your role needs to change.
      </p>

      <form onSubmit={onSubmit} className="sb-dashboard-grid">
        <label className="sb-field">
          <span>Display name</span>
          <input
            className="sb-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </label>

        <div className="sb-field">
          <span>Role</span>
          <select className="sb-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="sb-muted" style={{ fontSize: "0.8125rem", fontWeight: 400 }}>
            {ROLES.find((x) => x.value === role)?.hint}
          </span>
        </div>

        {error ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "var(--sb-radius-sm)",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.9375rem",
            }}
          >
            {formatApiError(error)}
          </div>
        ) : null}

        <button type="submit" className="sb-btn sb-btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Continue to dashboard"}
        </button>
      </form>
    </div>
  );
}
