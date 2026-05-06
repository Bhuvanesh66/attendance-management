import { ProgrammeManagerDashboard } from "./ProgrammeManagerDashboard.jsx";

/**
 * Monitoring Officer is a read-only variant of the Programme Manager
 * dashboard. The shared component handles the read-only banner and hides
 * all create/edit/delete actions when `readOnly` is true.
 */
export function MonitoringOfficerDashboard() {
  return <ProgrammeManagerDashboard readOnly />;
}
