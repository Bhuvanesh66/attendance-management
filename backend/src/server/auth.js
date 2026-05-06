const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
const { db } = require("../db/db");

// Clerk rejects tokens when `iat` is ahead of server time; default skew is only 5s.
// Windows / VMs often drift more — allow tuning via env (milliseconds).
const clerkClockSkewMs = Number(process.env.CLERK_CLOCK_SKEW_IN_MS || 60_000);

// Session JWT `azp` must match an authorized frontend origin (comma-separated).
const clerkAuthorizedParties = (() => {
  const raw = process.env.CLERK_AUTHORIZED_PARTIES || "http://localhost:5173";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : ["http://localhost:5173"];
})();

// Clerk middleware attaches `req.auth` (userId, sessionId, etc.)
const clerkRequireAuth = ClerkExpressRequireAuth({
  clockSkewInMs: clerkClockSkewMs,
  authorizedParties: clerkAuthorizedParties,
});

async function authMiddleware(req, res, next) {
  clerkRequireAuth(req, res, async (err) => {
    if (err) return next(err);
    try {
      // Normalize into a small shape we control.
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        const e = new Error("Unauthenticated");
        e.status = 401;
        throw e;
      }

      const claims = req.auth?.sessionClaims || {};

      // Best-effort name / email from Clerk claims (shape varies by instance).
      const name =
        claims.name ||
        claims.full_name ||
        (claims.username ? String(claims.username) : null) ||
        null;

      let email = null;
      if (typeof claims.email === "string" && claims.email.includes("@")) {
        email = claims.email.trim().toLowerCase();
      } else if (
        claims.primary_email_address &&
        typeof claims.primary_email_address.email_address === "string"
      ) {
        email = claims.primary_email_address.email_address.trim().toLowerCase();
      }

      req.auth = { clerkUserId, name, email };

      // Load user row if it exists (some routes want it)
      req.user = await db.users.getByClerkUserId(clerkUserId);
      return next();
    } catch (e) {
      return next(e);
    }
  });
}

function requireRole(allowedRoles) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role) {
      const e = new Error("User role not set");
      e.status = 403;
      return next(e);
    }
    if (!allowedRoles.includes(role)) {
      const e = new Error("Forbidden");
      e.status = 403;
      return next(e);
    }
    return next();
  };
}

module.exports = { authMiddleware, requireRole };

