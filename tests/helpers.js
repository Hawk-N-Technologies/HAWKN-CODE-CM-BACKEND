"use strict";

/**
 * Test helpers: a throw-away test database + the real server on a spare port.
 *
 * Needs TEST_DATABASE_URL pointing at a database whose name ends in "_test"
 * (refuses anything else, so it can never wipe real data).
 */

const { execFileSync, spawn } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.TEST_PORT || 3998);
const BASE = `http://localhost:${PORT}/api`;

function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "Set TEST_DATABASE_URL (e.g. postgresql://user:pass@localhost:5432/hawkn_test)",
    );
  }

  const dbName = new URL(url).pathname.replace(/^\//, "");

  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run: test database name must end in "_test" (got "${dbName}")`,
    );
  }

  return url;
}

const childEnv = () => ({
  ...process.env,
  DATABASE_URL: testDatabaseUrl(),
  PORT: String(PORT),
  NODE_ENV: "test",
  JWT_SECRET: process.env.JWT_SECRET || "test-only-secret-1234567890",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
});

// Wipe the test database and rebuild it with the project's own scripts
async function resetDatabase(sequelize) {
  await sequelize.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

  for (const command of ["migrate", "seed"]) {
    execFileSync("node", ["scripts.js", command], {
      cwd: ROOT,
      env: childEnv(),
      stdio: "pipe",
    });
  }
}

// Start the real server and wait until it answers
async function startServer() {
  const server = spawn("node", ["server.js"], {
    cwd: ROOT,
    env: childEnv(),
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return server;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  server.kill();
  throw new Error("Server did not start");
}

// A logged-in user: keeps the login cookie between requests
class Session {
  constructor() {
    this.cookie = "";
  }

  async request(method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];

    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      // not JSON
    }

    return { status: res.status, body: data, headers: res.headers };
  }

  static async login(email, password) {
    const session = new Session();
    const res = await session.request("POST", "/auth/login", { email, password });

    if (res.status !== 200) {
      throw new Error(`Login failed for ${email}: ${res.status}`);
    }

    return session;
  }
}

module.exports = {
  BASE,
  PORT,
  testDatabaseUrl,
  resetDatabase,
  startServer,
  Session,
};