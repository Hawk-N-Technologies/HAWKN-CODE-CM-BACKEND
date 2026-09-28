import { env } from "./config/env.js";
import app from "./app.js";

// Entry point: only starts the server. App setup lives in app.js,
// which keeps app.js easy to test later without opening a port.
const server = app.listen(env.port, () => {
  console.log(`🚀 HawkN API running on http://localhost:${env.port} [${env.nodeEnv}]`);
});

// Graceful shutdown (Ctrl+C / hosting platform stop signal)
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down...`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
