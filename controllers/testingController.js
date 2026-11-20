const testingService = require("../services/testingService");

// userId / companyId / role always come from the login token, never the request
const handle = (status, message, fn) => async (req, res, next) => {
  try {
    const data = await fn(req);
    return res.status(status).json({ success: true, message, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listTesterProjects: handle(200, "Projects fetched successfully", (req) =>
    testingService.listTesterProjects(req.user)),

  // Build Testing
  listBuilds: handle(200, "Builds fetched successfully", (req) =>
    testingService.listBuilds(req.user)),
  createBuild: handle(201, "Build added", (req) =>
    testingService.createBuild(req.user, req.body)),
  recordBuildResult: handle(200, "Build result saved", (req) =>
    testingService.recordBuildResult(req.user, req.params.uuid, req.body)),

  // Phase Testing
  listPhases: handle(200, "Phases fetched successfully", (req) =>
    testingService.listPhases(req.user)),
  signOffPhase: handle(200, "Phase sign-off saved", (req) =>
    testingService.signOffPhase(req.user, req.params.uuid, req.body)),

  // Client approval
  listClientPhases: handle(200, "Phases fetched successfully", (req) =>
    testingService.listClientPhases(req.user)),
  decidePhase: handle(200, "Thank you — your answer has been sent", (req) =>
    testingService.decidePhase(req.user, req.params.uuid, req.body)),

  // Field Training
  listTrainings: handle(200, "Training sessions fetched successfully", (req) =>
    testingService.listTrainings(req.user)),
  createTraining: handle(201, "Training scheduled", (req) =>
    testingService.createTraining(req.user, req.body)),
  updateTraining: handle(200, "Training updated", (req) =>
    testingService.updateTraining(req.user, req.params.uuid, req.body)),
};
