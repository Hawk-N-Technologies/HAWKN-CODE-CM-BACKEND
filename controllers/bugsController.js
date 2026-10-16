const bugsService = require("../services/bugsService");

async function reportBug(req, res) {
  try {
    console.log(req.body);

    const bug = await bugsService.createBug(req.user.userId, req.body);

    return res.status(201).json({
      success: true,
      message: "Bug reported successfully.",
      data: bug,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to report bug.",
    });
  }
}

module.exports = { reportBug };
