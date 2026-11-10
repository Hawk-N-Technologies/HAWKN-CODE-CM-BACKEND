const taskTestingService = require("../services/taskTestingService");

const getTestingQueue = async (req, res, next) => {
  try {
    const data = await taskTestingService.getTestingQueue(
      req.user.userId,
      req.user.companyId,
      {
        status: req.query.status,
        search: req.query.search,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Testing queue fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updateTestingStatus = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { status, testNotes } = req.body;

    if (!uuid) {
      return res.status(400).json({
        success: false,
        message: "Testing assignment UUID is required",
      });
    }

    if (!["Pending", "In Progress", "Passed", "Failed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testing status",
      });
    }

    if (
      testNotes !== undefined &&
      testNotes !== null &&
      typeof testNotes !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Test notes must be a string",
      });
    }

    if (status === "Failed" && !testNotes?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Test notes are required when a test fails",
      });
    }

    const data = await taskTestingService.updateTestingStatus(
      uuid,
      req.user.userId,
      req.user.companyId,
      { status, testNotes },
    );

    return res.status(200).json({
      success: true,
      message: "Testing result updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTestingQueue,
  updateTestingStatus,
};
