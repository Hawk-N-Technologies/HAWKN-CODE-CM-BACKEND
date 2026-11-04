const clientService = require("../services/clientService");

const createClient = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      type,
      gst,
      domain,
      phone,
      companyName,
      address,
    } = req.body;

    // Required validations
    if (!firstName?.trim()) {
      return res.status(400).json({
        message: "First name is required.",
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    if (!confirmPassword) {
      return res.status(400).json({
        message: "Confirm password is required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Password and confirm password do not match.",
      });
    }

    // Type validation
    const allowedTypes = ["lead", "converted"];

    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Type must be either lead or converted.",
      });
    }

    const client = await clientService.createClient({
      companyId,
      firstName,
      lastName,
      email,
      password,
      type,
      gst,
      domain,
      phone,
      companyName,
      address,
    });

    return res.status(201).json({
      message: "Client created successfully.",
      data: client,
    });
  } catch (error) {
    console.error("Create client error:", error);

    return res.status(error.statusCode || 400).json({
      message: error.message || "Failed to create client.",
    });
  }
};

const getClients = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, page = 1, limit = 10 } = req.query;
    console.log(search);
    const result = await clientService.getClients(companyId, {
      search,
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      message: "Clients fetched successfully.",
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    req.logger?.error?.("Get clients error:", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch clients.",
    });
  }
};

const getClientById = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const client = await clientService.getClientById(req.params.id, companyId);

    return res.status(200).json({
      message: "Client fetched successfully.",
      data: client,
    });
  } catch (error) {
    console.error("Get client error:", error);

    return res.status(404).json({
      message: error.message || "Client not found.",
    });
  }
};

const updateClient = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    console.log(req.body);
    const client = await clientService.updateClient(
      req.params.id,
      companyId,
      req.body,
    );

    return res.status(200).json({
      message: "Client updated successfully.",
      data: client,
    });
  } catch (error) {
    console.error("Update client error:", error);

    return res.status(400).json({
      message: error.message || "Failed to update client.",
    });
  }
};

async function clientProjectsDropdown(req, res) {
  try {
    const data = await clientService.clientProjectsDropdown(req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully.",
      data,
    });
  } catch (error) {
    console.error("Client projects dropdown error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch projects.",
    });
  }
}

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  clientProjectsDropdown,
};
