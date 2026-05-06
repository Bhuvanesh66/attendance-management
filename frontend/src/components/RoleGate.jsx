import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { DashboardRouter } from "../pages/DashboardRouter.jsx";

function describeProfileError(err) {
  const msg = String(err?.message || err || "");
  const status = err?.status;

  if (status === 401 || /unauthenticated/i.test(msg)) {
    return {
      title: "Session not accepted",
      body: "Your sign-in could not be verified by the API (expired session, wrong keys, or clock skew). Try refreshing the page or signing out and back in.",
    };
  }

  if (status === 403) {
    return {
      title: "Access denied",
      body: msg || "You do not have permission for this action.",
    };
  }

  if (
    err?.name === "TypeError" ||
    /failed to fetch|networkerror|load failed/i.test(msg)
  ) {
    return {
      title: "Cannot reach API",
      body: "The backend at your configured VITE_API_BASE_URL is not running or is blocked. From the project root run: npm run dev",
    };
  }

  if (status === 500 || status === 502 || status === 503) {
    return {
      title: "Couldn’t load your profile",
      body: "The server returned an error. Check the backend terminal for details, confirm DATABASE_URL and Clerk keys in backend/.env, and restart npm run dev.",
    };
  }

  return {
    title: "Couldn’t load your profile",
    body: msg || "Something went wrong while loading your account.",
  };
}

/** Loads `/me` once, then either completes signup routing or shows the role dashboard. */
export function RoleGate() {
  const { getToken } = useAuth();
  const [state, setState] = useState({ loading: true, user: null, institution: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch("/me", { token });
        if (!alive) return;
        setState({ loading: false, user: data.user, institution: data.institution || null, error: null });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, user: null, institution: null, error: e });
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  if (state.loading) {
    return (
      <div className="sb-loading-screen">
        <div className="sb-spinner" aria-hidden />
        <p className="sb-muted" style={{ margin: 0 }}>
          Loading your workspace…
        </p>
      </div>
    );
  }

  if (state.error) {
    const { title, body } = describeProfileError(state.error);
    return (
      <div className="sb-error-card">
        <h2>{title}</h2>
        <p style={{ margin: 0 }}>{body}</p>
      </div>
    );
  }

  if (!state.user?.role) {
    return <Navigate to="/complete-signup" replace />;
  }

  return <DashboardRouter user={state.user} institution={state.institution} />;
}
