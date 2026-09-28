import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

// --- Security & parsing (order matters: these run before routes) ---
app.use(helmet()); // sensible security headers
app.use(
  cors({
    origin: env.clientUrl, // only our frontend may call the API
    credentials: true, // allow cookies — frontend plans HttpOnly session cookies
  })
);
app.use(express.json({ limit: "1mb" })); // parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // read cookies (for auth later)
app.use(morgan(env.isProd ? "combined" : "dev")); // request logs

// --- All API routes live under /api/v1 ---
app.use("/api/v1", apiRoutes);

// --- These two MUST stay last ---
app.use(notFound);
app.use(errorHandler);

export default app;
