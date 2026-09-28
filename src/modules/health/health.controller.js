import { sendSuccess } from "../../utils/apiResponse.js";

// Simple "is the server alive?" check. DB status gets added in feature/db.
export const getHealth = (req, res) =>
  sendSuccess(res, {
    message: "HawkN API is running",
    data: { uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() },
  });
