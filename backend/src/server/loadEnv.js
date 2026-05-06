const path = require("path");
const dotenv = require("dotenv");

function loadBackendEnv() {
  const envPath = path.join(__dirname, "..", "..", ".env");

  // Try UTF-8 first (most common)
  const r1 = dotenv.config({ path: envPath, encoding: "utf8", override: true });
  if (r1.error) return r1;
  if (r1.parsed && Object.keys(r1.parsed).length > 0) return r1;

  // Some Windows editors save `.env` as UTF-16 LE, which dotenv won't parse as UTF-8.
  const r2 = dotenv.config({ path: envPath, encoding: "utf16le", override: true });
  return r2;
}

module.exports = { loadBackendEnv };

