function requireEnv(key) {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

function getCorsOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,https://attendance-management-frontend-lime.vercel.app";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedCorsOrigin(origin, allowList) {
  if (!origin) return true; // non-browser clients (curl, server-to-server)

  // Allow any Vercel deployment URL by default (preview + prod).
  // This prevents constant CORS breakage when Vercel generates a new domain.
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".vercel.app")) return true;
  } catch (_) {
    // ignore parse errors; fall back to allowList check
  }

  return allowList.includes(origin);
}

module.exports = { requireEnv, getCorsOrigins, isAllowedCorsOrigin };

