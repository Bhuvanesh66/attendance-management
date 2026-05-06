export function Badge({ tone = "neutral", children, dot = false }) {
  return (
    <span className={`ui-badge ui-badge--${tone}`}>
      {dot ? <span className="ui-badge__dot" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    present: { tone: "success", label: "Present" },
    absent: { tone: "danger", label: "Absent" },
    late: { tone: "warning", label: "Late" },
    active: { tone: "success", label: "Live now" },
    upcoming: { tone: "info", label: "Upcoming" },
    ended: { tone: "neutral", label: "Ended" },
  };
  const s = map[status];
  if (!s) return <Badge tone="neutral">Not marked</Badge>;
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function RoleBadge({ role }) {
  const map = {
    Student: { label: "Student", tone: "info" },
    Trainer: { label: "Trainer", tone: "brand" },
    Institution: { label: "Institution", tone: "warning" },
    ProgrammeManager: { label: "Programme Manager", tone: "success" },
    MonitoringOfficer: { label: "Monitoring Officer", tone: "neutral" },
  };
  const r = map[role] || { label: role, tone: "neutral" };
  return <Badge tone={r.tone}>{r.label}</Badge>;
}
