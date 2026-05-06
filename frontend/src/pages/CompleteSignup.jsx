import { useAuth, useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { formatApiError } from "../lib/errors.js";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  useToast,
} from "../components/ui/index.js";

const ROLES = [
  { value: "Student", label: "Student", hint: "Join batches and mark attendance for sessions you attend.", icon: "🎓" },
  { value: "Trainer", label: "Trainer", hint: "Create batches, schedule sessions, and review attendance.", icon: "🧑‍🏫" },
  { value: "Institution", label: "Institution", hint: "Set up your organisation and oversee its trainers and batches.", icon: "🏢" },
  { value: "ProgrammeManager", label: "Programme Manager", hint: "Cross-institution attendance summaries for your region.", icon: "📊" },
  { value: "MonitoringOfficer", label: "Monitoring Officer", hint: "Read-only programme-wide reporting.", icon: "🔍" },
];

export function CompleteSignup() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [role, setRole] = useState("Student");
  const [name, setName] = useState(user?.fullName || "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      await apiFetch("/auth/complete-signup", {
        token,
        method: "POST",
        body: { role, name },
      });
      toast.success("Welcome! Loading your workspace…");
      nav("/app", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Almost there"
        title="Pick your role"
        subtitle="Choose how you'll use SkillBridge. Your role determines which dashboard and permissions you get."
      />

      <form onSubmit={onSubmit}>
        <Card>
          <Field label="Display name" hint="Shown to trainers/institutions when relevant.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </Field>

          <div className="ui-stack ui-stack--sm" style={{ marginTop: "1.25rem" }}>
            <span className="ui-field__label">Role</span>
            <div className="ui-stack ui-stack--sm" role="radiogroup">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "0.85rem",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    border: `1.5px solid ${role === r.value ? "var(--sb-brand)" : "var(--sb-border)"}`,
                    borderRadius: "var(--sb-radius)",
                    background: role === r.value ? "var(--sb-brand-soft)" : "var(--sb-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.label}</div>
                    <div className="ui-muted" style={{ fontSize: "0.85rem" }}>{r.hint}</div>
                  </div>
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ accentColor: "var(--sb-brand)" }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="ui-form-actions" style={{ marginTop: "1.25rem" }}>
            <Button type="submit" loading={saving} disabled={!role}>
              Continue to dashboard
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
