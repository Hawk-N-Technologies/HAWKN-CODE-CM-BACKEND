import { Router } from "express";
import healthRoutes from "../modules/health/health.routes.js";

/**
 * Central router — every module plugs in here.
 * Each new feature branch adds ONE line below, e.g.:
 *   router.use("/auth", authRoutes);       // feature/auth
 *   router.use("/clients", clientRoutes);  // feature/clients
 */
const router = Router();

router.use("/health", healthRoutes);

export default router;
