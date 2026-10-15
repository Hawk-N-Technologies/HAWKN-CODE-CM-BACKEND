const kanbanService = require("../services/kanbanService");

function getCompanyId(req) {
  return req.user?.companyId ?? req.user?.company_id ?? null;
}

const getBoard = async (req, res) => {
  try {
    const data = await kanbanService.getBoard(
      getCompanyId(req),
      req.params.projectUuid,
    );

    return res.status(200).json({
      success: true,
      message: "Kanban board retrieved successfully.",
      data,
      count: data.count,
    });
  } catch (error) {
    console.error("Get Kanban board error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch Kanban board.",
    });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { status, testerUuid } = req.body || {};

    const data = await kanbanService.updateTaskStatus(
      getCompanyId(req),
      req.params.taskUuid,
      status,
      req.user,
      testerUuid,
    );

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully.",
      data,
    });
  } catch (error) {
    console.error("Update task status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update task status.",
    });
  }
};

const updateTestingResult = async (req, res) => {
  try {
    const { status, testNotes } = req.body || {};

    const data = await kanbanService.updateTestingResult(
      getCompanyId(req),
      req.params.testingUuid,
      status,
      testNotes,
      req.user,
    );

    return res.status(200).json({
      success: true,
      message: "Testing result saved successfully.",
      data,
    });
  } catch (error) {
    console.error("Update testing result error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to save testing result.",
    });
  }
};

module.exports = {
  getBoard,
  updateTaskStatus,
  updateTestingResult,
};
