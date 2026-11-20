const deliveryService = require("../services/deliveryService");

// userId / companyId / role always come from the login token, never the request
const send = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

async function listDeliveries(req, res, next) {
  try {
    const data = await deliveryService.listDeliveries(req.user);
    return send(res, 200, "Deliveries fetched successfully", data);
  } catch (error) {
    return next(error);
  }
}

async function testerProjects(req, res, next) {
  try {
    const data = await deliveryService.testerProjects(req.user);
    return send(res, 200, "Projects fetched successfully", data);
  } catch (error) {
    return next(error);
  }
}

async function createDelivery(req, res, next) {
  try {
    const data = await deliveryService.createDelivery(req.user, req.body);
    return send(res, 201, "Delivery submitted for admin approval", data);
  } catch (error) {
    return next(error);
  }
}

async function updateDelivery(req, res, next) {
  try {
    const data = await deliveryService.updateDelivery(req.user, req.params.uuid, req.body);
    return send(res, 200, "Delivery resubmitted for admin approval", data);
  } catch (error) {
    return next(error);
  }
}

async function approveDelivery(req, res, next) {
  try {
    const data = await deliveryService.approveDelivery(req.user, req.params.uuid);
    return send(res, 200, "Delivery approved and sent to the client", data);
  } catch (error) {
    return next(error);
  }
}

async function sendBackDelivery(req, res, next) {
  try {
    const data = await deliveryService.sendBackDelivery(req.user, req.params.uuid, req.body.note);
    return send(res, 200, "Delivery sent back to the tester", data);
  } catch (error) {
    return next(error);
  }
}

async function acceptDelivery(req, res, next) {
  try {
    const data = await deliveryService.acceptDelivery(req.user, req.params.uuid);
    return send(res, 200, "Delivery accepted. The project is now completed.", data);
  } catch (error) {
    return next(error);
  }
}

async function requestFollowUp(req, res, next) {
  try {
    const data = await deliveryService.requestFollowUp(req.user, req.params.uuid, req.body);
    return send(res, 201, "Follow-up sent. We've raised a Change Request for you.", data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listDeliveries,
  testerProjects,
  createDelivery,
  updateDelivery,
  approveDelivery,
  sendBackDelivery,
  acceptDelivery,
  requestFollowUp,
};
