"use strict";

/**
 * Phone / laptop alerts (Web Push).
 *
 * Every in-app notification is also sent to the devices where the person
 * turned on alerts — it pops up like a WhatsApp or email alert, even when
 * the website is closed.
 *
 * Needs three settings in .env (generate the keys once with
 *   npx web-push generate-vapid-keys ):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:hr@company.com)
 * Without them, alerts are simply off; in-app notifications still work.
 */

const webpush = require("web-push");
const { Op } = require("@sequelize/core");
const PushSubscription = require("../models/PushSubscription");
const logger = require("../utils/logger");

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "";

let enabled = false;

if (PUBLIC_KEY && PRIVATE_KEY && SUBJECT) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    enabled = true;
  } catch (error) {
    logger.error("Phone/laptop alerts are off: invalid VAPID settings", {
      error: error.message,
    });
  }
} else {
  logger.info("Phone/laptop alerts are off (VAPID keys not set)");
}

// Only real browser push services — the server sends requests to these
// addresses, so anything else is refused.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  ".notify.windows.com",
  ".push.apple.com",
];

const isAllowedEndpoint = (endpoint) => {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return PUSH_HOSTS.some((host) =>
      host.startsWith(".") ? url.hostname.endsWith(host) : url.hostname === host,
    );
  } catch {
    return false;
  }
};

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isEnabled = () => enabled;

const getPublicKey = () => (enabled ? PUBLIC_KEY : null);

// Save this device for the logged-in user (a device that changed hands is
// moved to the new user).
async function subscribe(user, subscription, userAgent) {
  if (!enabled) throw httpError(503, "Phone/laptop alerts are not set up yet.");

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2000 ||
    !isAllowedEndpoint(endpoint) ||
    typeof p256dh !== "string" ||
    p256dh.length > 255 ||
    typeof auth !== "string" ||
    auth.length > 255
  ) {
    throw httpError(400, "Invalid alert subscription.");
  }

  const values = {
    companyId: user.companyId,
    userId: user.userId,
    p256dh,
    auth,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
  };

  const existing = await PushSubscription.findOne({ where: { endpoint } });

  if (existing) {
    await existing.update(values);
  } else {
    await PushSubscription.create({ ...values, endpoint });
  }

  return { subscribed: true };
}

// Remove this device for the logged-in user (logout, or alerts turned off)
async function unsubscribe(user, endpoint) {
  if (typeof endpoint !== "string" || !endpoint) return { subscribed: false };

  await PushSubscription.destroy({
    where: { endpoint, userId: user.userId, companyId: user.companyId },
  });

  return { subscribed: false };
}

/**
 * Send one alert to every device of these users. Never throws: an alert
 * that fails must not break the action that caused it. Devices the push
 * service says are gone (404/410) are removed.
 */
async function sendToUsers(companyId, userIds, notification) {
  if (!enabled || !userIds?.length) return;

  try {
    const subscriptions = await PushSubscription.findAll({
      where: { companyId, userId: { [Op.in]: userIds } },
    });

    const payload = JSON.stringify({
      title: String(notification.title || "HawkN").slice(0, 120),
      body: String(notification.message || "").slice(0, 300),
      link: typeof notification.link === "string" ? notification.link : "/",
      tag: notification.uuid || undefined,
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 24 * 60 * 60 },
          );
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await sub.destroy();
          } else {
            logger.warn("Phone/laptop alert failed", {
              userId: sub.userId,
              statusCode: error.statusCode,
              error: error.message,
            });
          }
        }
      }),
    );
  } catch (error) {
    logger.error("Sending phone/laptop alerts failed", { error: error.message });
  }
}

module.exports = {
  isEnabled,
  getPublicKey,
  subscribe,
  unsubscribe,
  sendToUsers,
  isAllowedEndpoint,
};
