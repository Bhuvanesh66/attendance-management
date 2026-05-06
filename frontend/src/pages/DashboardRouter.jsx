import { StudentDashboard } from "./dashboards/StudentDashboard.jsx";
import { TrainerDashboard } from "./dashboards/TrainerDashboard.jsx";
import { InstitutionDashboard } from "./dashboards/InstitutionDashboard.jsx";
import { ProgrammeManagerDashboard } from "./dashboards/ProgrammeManagerDashboard.jsx";
import { MonitoringOfficerDashboard } from "./dashboards/MonitoringOfficerDashboard.jsx";

export function DashboardRouter({ user }) {
  switch (user.role) {
    case "Student":
      return <StudentDashboard />;
    case "Trainer":
      return <TrainerDashboard profile={user} />;
    case "Institution":
      return <InstitutionDashboard profile={user} />;
    case "ProgrammeManager":
      return <ProgrammeManagerDashboard />;
    case "MonitoringOfficer":
      return <MonitoringOfficerDashboard />;
    default:
      return (
        <div className="sb-card">
          <p style={{ margin: 0 }}>
            Unknown role: <strong>{String(user.role)}</strong>
          </p>
        </div>
      );
  }
}
