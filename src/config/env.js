import dotenv from "dotenv";

// Loads variables from .env into process.env (only once, at startup)
dotenv.config();

// Fail fast: if a required var is missing, crash at boot with a clear
// message instead of failing weirdly at runtime.
const REQUIRED = ["PORT", "CLIENT_URL"];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(", ")}. Check your .env file.`);
}

// Single place the rest of the app reads config from — never use
// process.env directly in other files.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT),
  clientUrl: process.env.CLIENT_URL,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};
