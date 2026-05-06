import { SignedIn, SignedOut, SignIn, SignUp, UserButton } from "@clerk/clerk-react";
import { Navigate, Route, Routes, Link } from "react-router-dom";
import { RoleGate } from "./components/RoleGate.jsx";
import { CompleteSignup } from "./pages/CompleteSignup.jsx";

export default function App() {
  return (
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
                  <section className="sb-hero">
                    <h1>Attendance that stays in sync</h1>
                    <p>
                      SkillBridge connects trainers, students, and institutions. Sign in to open your
                      role-based dashboard and manage sessions and attendance.
                    </p>
                    <div className="sb-actions">
                      <Link to="/sign-in" className="sb-btn sb-btn-primary">
                        Sign in
                      </Link>
                      <Link to="/sign-up" className="sb-btn sb-btn-secondary">
                        Create account
                      </Link>
                    </div>
                  </section>
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
              <div className="sb-card" style={{ maxWidth: 420, margin: "0 auto" }}>
                <SignIn routing="path" path="/sign-in" />
              </div>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <div className="sb-card" style={{ maxWidth: 420, margin: "0 auto" }}>
                <SignUp routing="path" path="/sign-up" />
              </div>
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
  );
}

