/**
 * One response shape for the whole API so the frontend always knows
 * what to expect:  { success: true, message, data }
 */
export const sendSuccess = (res, { data = null, message = "OK", statusCode = 200 } = {}) =>
  res.status(statusCode).json({ success: true, message, data });
