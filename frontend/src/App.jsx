import { SignedIn, SignedOut, SignIn, SignUp, UserButton } from "@clerk/clerk-react";
import { Navigate, Route, Routes, Link } from "react-router-dom";
import { RoleGate } from "./components/RoleGate.jsx";
import { CompleteSignup } from "./pages/CompleteSignup.jsx";
import { ToastProvider } from "./components/ui/index.js";

function Landing() {
  return (
    <section className="sb-hero">
      <div className="sb-hero__chips">
        <span className="sb-hero__chip">Government skilling programmes</span>
        <span className="sb-hero__chip">Five role workspaces</span>
        <span className="sb-hero__chip">Live attendance</span>
      </div>
      <h1>SkillBridge — attendance that stays in sync.</h1>
      <p>
        SkillBridge is a state-level skilling programme platform connecting students,
        trainers, institutions, programme managers, and monitoring officers — all from a
        single, role-aware workspace.
      </p>
      <div className="sb-actions">
        <Link to="/sign-in" className="sb-btn sb-btn-primary">
          Sign in
        </Link>
        <Link to="/sign-up" className="sb-btn sb-btn-secondary">
          Create account
        </Link>
      </div>
      <div className="sb-roles">
        <div className="sb-role-tile">
          <strong>Student</strong>
          <span>Join batches and self-mark attendance.</span>
        </div>
        <div className="sb-role-tile">
          <strong>Trainer</strong>
          <span>Run batches, sessions, and invite students.</span>
        </div>
        <div className="sb-role-tile">
          <strong>Institution</strong>
          <span>Create your organisation and oversee its trainers and batches.</span>
        </div>
        <div className="sb-role-tile">
          <strong>Programme Manager</strong>
          <span>Cross-institution attendance dashboards.</span>
        </div>
        <div className="sb-role-tile">
          <strong>Monitoring Officer</strong>
          <span>Read-only programme-wide reporting.</span>
        </div>
      </div>
    </section>
  );
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="sb-auth-shell">
      <div className="sb-auth-shell__intro">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <div className="sb-app">
        <header className="sb-header">
          <Link to="/" className="sb-logo">
            <span className="sb-logo-mark" aria-hidden>
              SB
            </span>
            SkillBridge
          </Link>
          <div style={{ flex: 1 }} />
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: 36, height: 36 },
                },
              }}
            />
          </SignedIn>
        </header>

        <main className="sb-main">
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <SignedOut>
                    <Landing />
                  </SignedOut>
                  <SignedIn>
                    <Navigate to="/app" replace />
                  </SignedIn>
                </>
              }
            />
            <Route
              path="/sign-in/*"
              element={
                <AuthShell title="Welcome back" subtitle="Sign in to your role-based dashboard.">
                  <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
                </AuthShell>
              }
            />
            <Route
              path="/sign-up/*"
              element={
                <AuthShell title="Create your account" subtitle="You'll pick your role on the next step.">
                  <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
                </AuthShell>
              }
            />
            <Route
              path="/complete-signup"
              element={
                <SignedIn>
                  <CompleteSignup />
                </SignedIn>
              }
            />
            <Route
              path="/app"
              element={
                <SignedIn>
                  <RoleGate />
                </SignedIn>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
