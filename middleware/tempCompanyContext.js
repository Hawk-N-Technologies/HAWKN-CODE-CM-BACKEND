/**
 * TEMPORARY — until feature/auth is merged.
 * Auth will set req.user (with companyId). Until then, act as company 1
 * so the APIs can be tested. DELETE this file + its line in server.js
 * once auth is merged.
 */
function tempCompanyContext(req, res, next) {
  // Only fill in if auth hasn't set a user — never overwrite real login
  if (!req.user) {
    req.user = { companyId: Number(process.env.DEFAULT_COMPANY_ID || 1) };
  }
  next(); // hand the request to the next middleware/route — without this every request hangs
}

module.exports = tempCompanyContext;