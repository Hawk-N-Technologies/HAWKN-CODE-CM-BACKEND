const Notification = require("../models/Notification");
const User = require("../models/User");
const Role = require("../models/Role");
const { getNotificationSocket } = require("../utils/notificationSocket");

async function notifyAdmins({
  companyId,
  type,
  title,
  message,
  link = null,
  eventKey = null,
  metadata = {},
  excludeUserId = null,
}) {
  if (!companyId || !type || !title || !message) {
    throw new Error("Company, type, title, and message are required.");
  }

  const admins = await User.findAll({
    where: {
      companyId,
      isActive: true,
    },
    include: [
      {
        model: Role,
        as: "role",
        where: { name: "admin", isActive: true },
        attributes: [],
        required: true,
      },
    ],
    attributes: ["id"],
  });

  const recipients = admins.filter(
    (admin) => Number(admin.id) !== Number(excludeUserId),
  );

  if (recipients.length === 0) {
    return [];
  }

  const created = await Notification.bulkCreate(
    recipients.map((admin) => ({
      companyId,
      recipientUserId: admin.id,
      type,
      title,
      message,
      link,
      eventKey,
      metadata,
    })),
    { returning: true },
  );

  const socket = getNotificationSocket();

  if (socket) {
    for (const notification of created) {
      socket
        .to(`user:${companyId}:${notification.recipientUserId}`)
        .emit("notification:new", notification.toJSON());
    }
  }

  return created;
}

async function listForUser({ companyId, userId, limit = 50, offset = 0 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [notifications, unreadCount, total] = await Promise.all([
    Notification.findAll({
      where: { companyId, recipientUserId: userId },
      order: [["createdAt", "DESC"]],
      limit: safeLimit,
      offset: safeOffset,
    }),
    Notification.count({
      where: { companyId, recipientUserId: userId, readAt: null },
    }),
    Notification.count({
      where: { companyId, recipientUserId: userId },
    }),
  ]);

  return { notifications, unreadCount, total, limit: safeLimit, offset: safeOffset };
}

async function markRead({ companyId, userId, notificationId }) {
  const notification = await Notification.findOne({
    where: {
      id: notificationId,
      companyId,
      recipientUserId: userId,
    },
  });

  if (!notification) return null;

  if (!notification.readAt) {
    await notification.update({ readAt: new Date() });
  }

  return notification;
}

async function markAllRead({ companyId, userId }) {
  const [updatedCount] = await Notification.update(
    { readAt: new Date() },
    {
      where: {
        companyId,
        recipientUserId: userId,
        readAt: null,
      },
    },
  );

  return updatedCount;
}

module.exports = {
  notifyAdmins,
  listForUser,
  markRead,
  markAllRead,
};