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
      phone,
      companyName,
      address,
    } = req.body;

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

    if (!password) {
      return res.status(400).json({
        message: "Password is required.",
      });
    }
 
    const client = await clientService.createClient({
      companyId,
      firstName,
      lastName,
      email,
      password,
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

    return res.status(400).json({
      message: error.message || "Failed to create client.",
    });
  }
};

const getClients = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const clients = await clientService.getClients(companyId);

    return res.status(200).json({
      message: "Clients fetched successfully.",
      data: clients,
    });
  } catch (error) {
    console.error("Get clients error:", error);

    return res.status(500).json({
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

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
};
