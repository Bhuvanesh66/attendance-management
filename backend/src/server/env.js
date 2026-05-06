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

module.exports = { requireEnv, getCorsOrigins };

