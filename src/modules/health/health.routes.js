import { Router } from "express";
import { getHealth } from "./health.controller.js";

const router = Router();

router.get("/", getHealth); // GET /api/v1/health

export default router;
