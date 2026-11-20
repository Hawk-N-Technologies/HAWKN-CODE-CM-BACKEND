const sopService = require("../services/sopService");

// companyId / userId always come from the login token, never the request
const handle = (status, message, fn) => async (req, res, next) => {
  try {
    const data = await fn(req);
    return res.status(status).json({ success: true, message, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSops: handle(200, "SOPs fetched successfully", (req) => sopService.listSops(req.user)),
  getSop: handle(200, "SOP fetched successfully", (req) => sopService.getSop(req.user, req.params.uuid)),
  createSop: handle(201, "SOP created", (req) => sopService.createSop(req.user, req.body)),
  updateSop: handle(200, "SOP saved", (req) => sopService.updateSop(req.user, req.params.uuid, req.body)),
  deleteSop: handle(200, "SOP deleted", (req) => sopService.deleteSop(req.user, req.params.uuid)),
};
