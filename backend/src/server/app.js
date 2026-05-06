require("express-async-errors");
const express = require("express");
const cors = require("cors");
const { ZodError } = require("zod");

const { getCorsOrigins, isAllowedCorsOrigin } = require("./env");
const { registerRoutes } = require("./routes");

function createApp() {
  const app = express();
  const corsOrigins = getCorsOrigins();

  app.use(
    cors({
      origin: (origin, cb) => {
        if (isAllowedCorsOrigin(origin, corsOrigins)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => {
    const payload = {
      ok: true,
      service: "skillbridge-backend",
      time: new Date().toISOString(),
    };
    // ?format=json forces JSON (curl, scripts). Browsers send Accept: text/html → show a real page.
    const accept = String(req.get("accept") || "");
    const forceJson = req.query.format === "json" || accept.includes("application/json");
    const browserTab = accept.includes("text/html") && !forceJson;

    if (browserTab) {
      const safe = JSON.stringify(payload, null, 2);
      return res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SkillBridge API · Health</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.5;background:#f8fafc;color:#0f172a}pre{background:#fff;padding:1rem;border-radius:8px;border:1px solid #e2e8f0}</style>
</head><body>
<h1>API is running</h1>
<p>Health check for the SkillBridge backend. Machine-readable JSON: <a href="/health?format=json"><code>/health?format=json</code></a></p>
<pre>${safe}</pre>
</body></html>`);
    }

    return res.json(payload);
  });

  app.get("/", (_req, res) => {
    res.type("html").send(`<!DOCTYPE html>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SkillBridge API</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem;background:#f8fafc;color:#0f172a}a{color:#5b4dff}</style>
<h1>SkillBridge backend</h1>
<p><a href="/health">Human-readable health</a> · <a href="/health?format=json">JSON health</a></p>`);
  });

  registerRoutes(app);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (res.headersSent) {
      return;
    }
    console.error(err);

    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validation error",
        issues: err.flatten(),
      });
    }

    // PostgreSQL errors from `pg` (column type / enum / NOT NULL mismatches vs app).
    const pgCode = err?.code;
    const devHint =
      process.env.NODE_ENV !== "production" ? String(err?.message || "") : undefined;
    if (pgCode === "22P02") {
      return res.status(400).json({
        error:
          "Database rejected a value (often role stored as a mismatched enum). Run: npm run migrate -w backend",
        hint: devHint || undefined,
      });
    }
    if (pgCode === "23502") {
      return res.status(400).json({
        error:
          "Database constraint violated (e.g. NOT NULL without a default). Run: npm run migrate -w backend",
        hint: devHint || undefined,
      });
    }

    let status =
      typeof err?.status === "number"
        ? err.status
        : typeof err?.statusCode === "number"
          ? err.statusCode
          : undefined;

    const msg = String(err?.message || "");

    if (status === undefined) {
      if (msg === "Unauthenticated") {
        status = 401;
      } else if (msg === "Forbidden") {
        status = 403;
      } else {
        status = 500;
      }
    }

    const body =
      status === 500
        ? { error: "Internal Server Error" }
        : { error: err.message || msg, ...(err?.payload && typeof err.payload === "object" ? err.payload : {}) };

    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
