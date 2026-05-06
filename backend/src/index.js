const { loadBackendEnv } = require("./server/loadEnv");
loadBackendEnv();

const { createApp } = require("./server/app");
const { requireEnv } = require("./server/env");

const PORT = Number(process.env.PORT || 4000);

function main() {
  requireEnv("DATABASE_URL");
  requireEnv("CLERK_SECRET_KEY");
  requireEnv("CLERK_PUBLISHABLE_KEY");

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT}`);
  });
}

main();

