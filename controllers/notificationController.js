const notificationService = require("../services/notificationService");
const pushService = require("../services/pushService");

async function list(req, res, next) {
  try {
    const result = await notificationService.listForUser({
      companyId: req.user.companyId,
      userId: req.user.userId,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification = await notificationService.markRead({
      companyId: req.user.companyId,
      userId: req.user.userId,
      notificationId: id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    const updatedCount = await notificationService.markAllRead({
      companyId: req.user.companyId,
      userId: req.user.userId,
    });

    return res.status(200).json({
      success: true,
      data: { updatedCount },
    });
  } catch (error) {
    return next(error);
  }
}

async function createTestNotification(req, res, next) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({
      success: false,
      message: "Not found.",
    });
  }

  try {
    const notifications = await notificationService.notifyAdmins({
      companyId: req.user.companyId,
      type: "SYSTEM_TEST",
      title: "Notification test successful",
      message: "This is a development test notification from Hawk'N CM.",
      link: "/admin/notifications",
      eventKey: `test-${Date.now()}-${req.user.userId}`,
      metadata: { source: "development-test" },
    });

    return res.status(201).json({
      success: true,
      message: "Test notification created.",
      data: { createdCount: notifications.length },
    });
  } catch (error) {
    return next(error);
  }
}

// Phone / laptop alerts: the key the browser needs to subscribe
async function getPushPublicKey(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: {
        enabled: pushService.isEnabled(),
        publicKey: pushService.getPublicKey(),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function subscribePush(req, res, next) {
  try {
    const data = await pushService.subscribe(
      req.user,
      req.body?.subscription,
      req.get("user-agent"),
    );

    return res.status(200).json({
      success: true,
      message: "Phone/laptop alerts are on for this device.",
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
}

async function unsubscribePush(req, res, next) {
  try {
    const data = await pushService.unsubscribe(req.user, req.body?.endpoint);

    return res.status(200).json({
      success: true,
      message: "Phone/laptop alerts are off for this device.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  markRead,
  markAllRead,
  createTestNotification,
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
};