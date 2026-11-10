const Notification = require("../models/Notification");
const User = require("../models/User");
const Role = require("../models/Role");
const { getNotificationSocket } = require("../utils/notificationSocket");

async function createForRecipients({
  companyId,
  recipientUserIds,
  type,
  title,
  message,
  link = null,
  eventKey = null,
  metadata = {},
}) {
  if (!companyId || !type || !title || !message) {
    throw new Error("Company, type, title, and message are required.");
  }

  const uniqueIds = [...new Set((recipientUserIds || []).map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!uniqueIds.length) return [];

  const records = uniqueIds.map((recipientUserId) => ({
    companyId,
    recipientUserId,
    type,
    title,
    message,
    link,
    eventKey,
    metadata,
  }));

  const created = await Notification.bulkCreate(records, { returning: true });
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

async function notifyRole({
  companyId,
  roleName,
  excludeUserId = null,
  ...notification
}) {
  if (!companyId || !roleName) {
    throw new Error("Company ID and role name are required.");
  }

  const users = await User.findAll({
    where: { companyId, isActive: true },
    include: [{
      model: Role,
      as: "role",
      where: { name: String(roleName).toLowerCase(), isActive: true },
      attributes: [],
      required: true,
    }],
    attributes: ["id"],
  });

  return createForRecipients({
    ...notification,
    companyId,
    recipientUserIds: users
      .filter((user) => Number(user.id) !== Number(excludeUserId))
      .map((user) => user.id),
  });
}

async function notifyAdmins(options) {
  return notifyRole({ ...options, roleName: "admin" });
}

async function notifyHR(options) {
  return notifyRole({ ...options, roleName: "hr" });
}

async function notifyUser({ companyId, userId, ...notification }) {
  return createForRecipients({
    ...notification,
    companyId,
    recipientUserIds: [userId],
  });
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
    Notification.count({ where: { companyId, recipientUserId: userId } }),
  ]);

  return { notifications, unreadCount, total, limit: safeLimit, offset: safeOffset };
}

async function markRead({ companyId, userId, notificationId }) {
  const notification = await Notification.findOne({
    where: { id: notificationId, companyId, recipientUserId: userId },
  });

  if (!notification) return null;
  if (!notification.readAt) await notification.update({ readAt: new Date() });
  return notification;
}

async function markAllRead({ companyId, userId }) {
  const [updatedCount] = await Notification.update(
    { readAt: new Date() },
    { where: { companyId, recipientUserId: userId, readAt: null } },
  );
  return updatedCount;
}

module.exports = {
  notifyAdmins,
  notifyHR,
  notifyUser,
  listForUser,
  markRead,
  markAllRead,
};